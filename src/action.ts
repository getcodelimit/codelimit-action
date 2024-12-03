import nodeFetch from "node-fetch";
import path from "path";
import fs from "fs";
import {getInput} from "@actions/core";
import {promisify} from "util";
import {context} from "@actions/github";
import {Octokit} from "@octokit/action";
import {
    branchExists,
    createBranch,
    createInitialCommit,
    createOrUpdateFile,
    createPRComment,
    getRepoName,
    getRepoOwner
} from "./github";
import {exec, getExecOutput} from "@actions/exec";
import {makeBadge} from "badge-maker";

const streamPipeline = promisify(require('stream').pipeline);


function getBinaryName() {
    const binaries: { [platform: string]: string } = {
        'darwin': 'codelimit-macos',
        'win32': 'codelimit.exe',
        'linux': 'codelimit-linux'
    };
    if (process.env.RUNNER_OS) {
        const platform = process.env.RUNNER_OS.toLowerCase();
        if (platform in binaries) {
            return binaries[platform];
        }
    }
    if (process.platform in binaries) {
        return binaries[process.platform];
    }
    return binaries['linux'];
}

async function getLatestBinaryUrl() {
    const latestUrl = 'https://github.com/getcodelimit/codelimit/releases/latest';
    const res = await nodeFetch(latestUrl);
    const downloadUrl = res.url.replace('/tag/', '/download/');
    return `${downloadUrl}/${getBinaryName()}`;
}

async function downloadBinary() {
    const binaryUrl = await getLatestBinaryUrl();
    console.log(`Downloading Code Limit binary from URL: ${binaryUrl}`);
    const response = await nodeFetch(binaryUrl);
    const filename = path.join(__dirname, getBinaryName());
    await streamPipeline(response.body, fs.createWriteStream(filename));
    fs.chmodSync(filename, '777');
    console.log(`Code Limit binary downloaded: ${filename}`);
    return filename;
}

async function getChangedFiles(token: string) {
    const eventName = context.eventName
    if (eventName === undefined) {
        return ['.'];
    }
    let base;
    let head;
    if (eventName === 'pull_request') {
        base = context.payload.pull_request?.base?.sha
        head = context.payload.pull_request?.head?.sha
    } else {
        base = context.payload.before
        head = context.payload.after
    }
    console.log(`Base commit: ${base}`);
    console.log(`Head commit: ${head}`);
    const octokit = new Octokit({auth: token});
    const response = await octokit.repos.compareCommits({
        base, head, owner: context.repo.owner, repo: context.repo.repo
    });
    if (response.status !== 200) {
        return ['.'];
    }
    const files = response.data.files
    const result = [];
    if (files) {
        for (const file of files) {
            const filename = file.filename
            if (file.status === 'modified' || file.status === 'added') {
                result.push(filename);
            }
        }
    }
    return result;
}

function isPullRequest() {
    return context.eventName === 'pull_request';
}

function getSourceBranch() {
    if (isPullRequest()) {
        return process.env.GITHUB_HEAD_REF;
    } else {
        return process.env.GITHUB_REF_NAME;
    }
}

async function createReportsBranchIfNotExists(octokit: Octokit, owner: string, repo: string) {
    if (!await branchExists(octokit, owner, repo, '_codelimit_reports')) {
        const initialCommitSha = await createInitialCommit(octokit, owner, repo);
        await createBranch(octokit, owner, repo, '_codelimit_reports', initialCommitSha);
    } else {
        console.log('Branch _codelimit_reports already exists');
    }
}

function makeBadgeSvg(message: string, color: 'red' | 'orange' | 'green' | 'grey'): string {
    const badge = {
        label: 'Code Limit',
        message: message,
        color: color
    };
    return makeBadge(badge);
}

function getReportContent(): string | undefined {
    return fs.readFileSync('.codelimit_cache/codelimit.json', 'utf8');
}

function getBadgeContent(reportContent: string | undefined): string {
    if (!reportContent) {
        return makeBadgeSvg('Not found', 'grey');
    } else {
        const reportJson = JSON.parse(reportContent);
        const profile = reportJson.codebase.tree['./'].profile
        if (profile[3] > 0) {
            return makeBadgeSvg('Needs refactoring', 'red');
        } else if (profile[2] > 0) {
            return makeBadgeSvg('Needs refactoring', 'orange');
        } else {
            return makeBadgeSvg('Passed', 'green');
        }
    }
}

async function main() {
    const filename = await downloadBinary();
    console.log('Scanning codebase...');
    await exec(filename, ['scan', '.']);
    const totalsMarkdown = await getExecOutput(filename, ['report', '--totals', '--format', 'markdown']);
    const unitsMarkdown = await getExecOutput(filename, ['report', '--full', '--format', 'markdown']);
    const markdownReport = `${totalsMarkdown.stdout}\n${unitsMarkdown.stdout}`;
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
    await createReportsBranchIfNotExists(octokit, owner, repo);
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
            exitCode = await exec(filename, ['app', 'upload', '--token', token, slug, branch]);
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
            exitCode = await exec(filename, ['check'].concat(changedFiles), {ignoreReturnCode: true});
        }
    }
    fs.unlinkSync(filename);
    console.log('Done!');
    process.exit(exitCode);
}

main();
