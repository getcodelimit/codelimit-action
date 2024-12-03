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

async function main() {
    const clBinary = await downloadCodeLimitBinary();
    console.log('Scanning codebase...');
    await exec(clBinary, ['scan', '.']);
    const markdownReport = await generateMarkdownReport(clBinary);
    const doUpload = getInput('upload') || false;
    const token = getInput('token');
    const octokit = new Octokit({auth: token});
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
    let exitCode = 0;
    if (doUpload) {
        console.log('Uploading results...');
        if (!token) {
            console.error('Token for upload not provided.');
            exitCode = 1;
        }
        const slug = context.payload.repository?.full_name;
        if (slug && branch) {
            exitCode = await exec(clBinary, ['app', 'upload', '--token', token, slug, branch]);
        }
    }
    const doCheck = getInput('check') || true;
    if (doCheck && exitCode === 0) {
        const changedFiles = await getChangedFiles(token);
        console.log(`Number of files changed: ${changedFiles.length}`);
        if (changedFiles.length === 0) {
            console.log('No files changed, skipping Code Limit');
        } else {
            console.log('Running Code Limit...');
            exitCode = await exec(clBinary, ['check'].concat(changedFiles), {ignoreReturnCode: true});
        }
    }
    fs.unlinkSync(clBinary);
    console.log('Done!');
    process.exit(exitCode);
}

main();
