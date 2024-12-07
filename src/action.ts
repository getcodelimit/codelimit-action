import fs from "fs";
import {getInput, getMultilineInput} from "@actions/core";
import {context} from "@actions/github";
import {Octokit} from "@octokit/action";
import {
    createBranchIfNotExists,
    createOrUpdateFile,
    createPRComment, getFile,
    getRepoName,
    getRepoOwner,
    getSourceBranch,
    isPullRequest, isPullRequestFromFork, updateComment
} from "./github";
import {exec, getExecOutput} from "@actions/exec";
import {downloadCodeLimitBinary, getBadgeContent, getReportContent} from "./codelimit";
import {getChangedFiles} from "./utils";
import {version} from "./version";

async function generateMarkdownReport(clBinary: string) {
    const totalsMarkdown = await getExecOutput(clBinary, ['report', '--totals', '--format', 'markdown']);
    const unitsMarkdown = await getExecOutput(clBinary, ['report', '--full', '--format', 'markdown']);
    let result = '';
    result += '## Codebase totals\n';
    result += totalsMarkdown.stdout;
    result += '\n';
    result += '## Refactoring report\n';
    result += unitsMarkdown.stdout;
    return result;
}

async function updateReportsBranch(octokit: Octokit, markdownReport: string) {
    const owner = getRepoOwner(context);
    const repo = getRepoName(context);
    const branch = getSourceBranch();
    if (!owner || !repo || !branch) {
        console.error('Could not determine repository owner, name, or branch');
        process.exit(1);
    }
    await createBranchIfNotExists(octokit, owner, repo, '_codelimit_reports');
    const reportContent = getReportContent();
    await createOrUpdateFile(octokit, owner, repo, '_codelimit_reports', `${branch}/badge.svg`, getBadgeContent(reportContent));
    if (reportContent) {
        await createOrUpdateFile(octokit, owner, repo, '_codelimit_reports', `${branch}/report.json`, reportContent);
    }
    await createOrUpdateFile(octokit, owner, repo, '_codelimit_reports', `${branch}/codelimit.md`, markdownReport);
    if (isPullRequest()) {
        await updatePullRequestComment(octokit, owner, repo, branch, markdownReport);
    }
}

async function updatePullRequestComment(octokit: Octokit, owner: string, repo: string, branchName: string, markdownReport: string) {
    const prNumber = context.payload.pull_request?.number;
    if (prNumber) {
        const actionStateFile = await getFile(octokit, owner, repo, '_codelimit_reports', `${branchName}/action.json`);
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
            await createOrUpdateFile(octokit, owner, repo, '_codelimit_reports', `${branchName}/action.json`, actionStateJson);
        }
    }
}

async function checkChangedFiles(octokit: Octokit, clBinary: string): Promise<number> {
    const changedFiles = await getChangedFiles(octokit);
    console.log(`Number of files changed: ${changedFiles.length}`);
    if (changedFiles.length === 0) {
        console.log('No files changed, skipping Code Limit');
        return 0;
    } else {
        console.log('Running Code Limit...');
        return await exec(clBinary, ['check'].concat(changedFiles), {ignoreReturnCode: true});
    }
}

async function main() {
    console.log(`Code Limit action, version: ${version.revision}`);
    let exitCode = 0;
    const clBinary = await downloadCodeLimitBinary();
    console.log('Scanning codebase...');
    const excludes = getMultilineInput('excludes');
    const excludeOpts = excludes.flatMap(e => ['--exclude', e]);
    await exec(clBinary, [...excludeOpts, 'scan', '.']);
    const markdownReport = await generateMarkdownReport(clBinary);
    const octokit = new Octokit({auth: getInput('token')});
    const doCheck = getInput('check') || true;
    if (doCheck) {
        exitCode = await checkChangedFiles(octokit, clBinary);
    }
    if (!isPullRequestFromFork()) {
        await updateReportsBranch(octokit, markdownReport);
    }
    fs.unlinkSync(clBinary);
    console.log('Done!');
    process.exit(exitCode);
}

main();
