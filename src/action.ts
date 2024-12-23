import fs from "fs";
import {getInput} from "@actions/core";
import {context} from "@actions/github";
import {Octokit} from "@octokit/action";
import {
    createBranchIfNotExists,
    createOrUpdateFile,
    createPRComment,
    getFile,
    getRepoName,
    getRepoOwner,
    getSourceBranch,
    isPullRequest,
    updateComment
} from "./github";
import {exec, getExecOutput} from "@actions/exec";
import {downloadCodeLimitBinary, getReportContent, makeNotFoundBadgeSvg, makeStatusBadgeSvg} from "./codelimit";
import {getChangedFiles} from "./utils";
import {version} from "./version";

async function generateMarkdownReport(clBinary: string) {
    const totalsMarkdown = await getExecOutput(clBinary, ['report', '--format', 'markdown']);
    const unitsMarkdown = await getExecOutput(clBinary, ['findings', '--format', 'markdown']);
    let result = '';
    result += '## Codebase totals\n';
    result += totalsMarkdown.stdout;
    result += '\n';
    result += '## Refactoring report\n';
    result += unitsMarkdown.stdout;
    return result;
}

async function updateReportsBranch(octokit: Octokit, owner: string, repo: string, branch: string, markdownReport: string) {
    await createBranchIfNotExists(octokit, owner, repo, '_codelimit_reports');
    const reportContent = getReportContent();
    let badgeContent;
    if (reportContent) {
        const reportJson = JSON.parse(reportContent);
        badgeContent = makeStatusBadgeSvg(reportJson.codebase);
    } else {
        badgeContent = makeNotFoundBadgeSvg();
    }
    await createOrUpdateFile(octokit, owner, repo, '_codelimit_reports', `${branch}/badge.svg`, badgeContent);
    if (reportContent) {
        await createOrUpdateFile(octokit, owner, repo, '_codelimit_reports', `${branch}/report.json`, reportContent);
    }
    await createOrUpdateFile(octokit, owner, repo, '_codelimit_reports', `${branch}/codelimit.md`, markdownReport);
}

async function updatePullRequestComment(octokit: Octokit, owner: string, repo: string, branch: string, markdownReport: string) {
    const prNumber = context.payload.pull_request?.number;
    if (prNumber) {
        const actionStateFile = await getFile(octokit, owner, repo, '_codelimit_reports', `${branch}/action.json`);
        if (actionStateFile) {
            const fileContent = Buffer.from(actionStateFile.content, 'base64').toString('utf-8');
            const actionState = JSON.parse(fileContent) as ActionState;
            const commentId = actionState.commentId;
            console.log(`Updating existing comment with ID: ${commentId}`);
            await updateComment(octokit, owner, repo, prNumber, markdownReport, commentId);
        } else {
            console.log('State file not found, creating new comment');
            const commentId = await createPRComment(octokit, owner, repo, prNumber, markdownReport);
            const actionState: ActionState = {commentId: commentId};
            const actionStateJson = JSON.stringify(actionState);
            await createOrUpdateFile(octokit, owner, repo, '_codelimit_reports', `${branch}/action.json`, actionStateJson);
        }
    }
}

async function checkChangedFiles(octokit: Octokit, clBinary: string): Promise<number> {
    const changedFiles = await getChangedFiles(octokit);
    console.log(`Number of files changed: ${changedFiles.length}`);
    if (changedFiles.length === 0) {
        console.log('No files changed, skipping CodeLimit');
        return 0;
    } else {
        console.log('Running CodeLimit...');
        return await exec(clBinary, ['check'].concat(changedFiles), {ignoreReturnCode: true});
    }
}

async function main() {
    console.log(`CodeLimit action, version: ${version.revision}`);
    let exitCode = 0;
    const clBinary = await downloadCodeLimitBinary();
    console.log('Scanning codebase...');
    await exec(clBinary, ['scan', '.']);
    const markdownReport = await generateMarkdownReport(clBinary);
    const octokit = new Octokit({auth: getInput('token')});
    const doCheck = getInput('check') || true;
    if (doCheck) {
        exitCode = await checkChangedFiles(octokit, clBinary);
    }
    const owner = getRepoOwner(context);
    const repo = getRepoName(context);
    const branch = getSourceBranch();
    if (!owner || !repo || !branch) {
        console.error('Could not determine repository owner, name, or branch');
        process.exit(1);
    }
    try {
        await updateReportsBranch(octokit, owner, repo, branch, markdownReport);
    } catch (e: unknown) {
        console.error('Failed to update reports branch');
        if (e instanceof Error) {
            console.error(`Reason: ${e.message}`);
        }
    }
    if (isPullRequest()) {
        await updatePullRequestComment(octokit, owner, repo, branch, markdownReport);
    }
    fs.unlinkSync(clBinary);
    console.log('Done!');
    process.exit(exitCode);
}

main();
