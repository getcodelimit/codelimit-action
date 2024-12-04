import fs from "fs";
import {getInput} from "@actions/core";
import {context} from "@actions/github";
import {Octokit} from "@octokit/action";
import {
    createBranchIfNotExists,
    createOrUpdateFile,
    createPRComment,
    getRepoName,
    getRepoOwner,
    getSourceBranch,
    isPullRequest
} from "./github";
import {exec, getExecOutput} from "@actions/exec";
import {downloadCodeLimitBinary, getBadgeContent, getReportContent} from "./codelimit";
import {getChangedFiles} from "./utils";

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
    if (!owner || !repo) {
        console.error('Could not determine repository owner or name');
        process.exit(1);
    }
    const branch = getSourceBranch();
    await createBranchIfNotExists(octokit, owner, repo, '_codelimit_reports');
    const reportContent = getReportContent();
    await createOrUpdateFile(octokit, owner, repo, '_codelimit_reports', `${branch}/badge.svg`, getBadgeContent(reportContent));
    if (reportContent) {
        await createOrUpdateFile(octokit, owner, repo, '_codelimit_reports', `${branch}/report.json`, reportContent);
    }
    await createOrUpdateFile(octokit, owner, repo, '_codelimit_reports', `${branch}/codelimit.md`, markdownReport);
    if (isPullRequest()) {
        const prNumber = context.payload.pull_request?.number;
        if (prNumber) {
            await createPRComment(octokit, owner, repo, prNumber, markdownReport);
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
    let exitCode = 0;
    const clBinary = await downloadCodeLimitBinary();
    console.log('Scanning codebase...');
    await exec(clBinary, ['scan', '.']);
    const markdownReport = await generateMarkdownReport(clBinary);
    const octokit = new Octokit({auth: getInput('token')});
    await updateReportsBranch(octokit, markdownReport);
    const doCheck = getInput('check') || true;
    if (doCheck) {
        exitCode = await checkChangedFiles(octokit, clBinary);
    }
    fs.unlinkSync(clBinary);
    console.log('Done!');
    process.exit(exitCode);
}

main();
