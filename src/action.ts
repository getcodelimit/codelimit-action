import nodeFetch from "node-fetch";
import path from "path";
import fs from "fs";
import {getInput} from "@actions/core";
import {promisify} from "util";
import {context} from "@actions/github";
import {Octokit} from "@octokit/action";
import {branchExists, createBranch, getBranchHeadSha, getDefaultBranch, getRepoName, getRepoOwner} from "./github";

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

function getSourceBranch() {
    if (context.eventName === 'pull_request') {
        return process.env.GITHUB_HEAD_REF;
    } else {
        return process.env.GITHUB_REF_NAME;
    }
}

async function main() {

    // const filename = await downloadBinary();
    // const doUpload = getInput('upload') || false;
    const token = getInput('token');
    const octokit = new Octokit({auth: token});
    const owner = getRepoOwner(context);
    const repo = getRepoName(context);
    if (!owner || !repo) {
        console.error('Could not determine repository owner or name');
        process.exit(1);
    }
    if (!await branchExists(octokit, owner, repo, '_codelimit_reports')) {
        const defaultBranch = getDefaultBranch(context);
        if (!defaultBranch) {
            console.error('Could not determine default branch');
            process.exit(1);
        }
        const sha = await getBranchHeadSha(octokit, owner, repo, defaultBranch);
        if (!sha) {
            console.error('Could not determine default branch sha');
            process.exit(1);
        }
        const empty_tree_object = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
        await createBranch(octokit, owner, repo, '_codelimit_reports', empty_tree_object);
    } else {
        console.log('Branch _codelimit_reports already exists');
    }

    // let exitCode = 0;
    // if (doUpload) {
    //     console.log('Scanning codebase...');
    //     await exec(filename, ['scan', '.']);
    //     console.log('Uploading results...');
    //     if (!token) {
    //         console.error('Token for upload not provided.');
    //         exitCode = 1;
    //     }
    //     const slug = context.payload.repository?.full_name;
    //     const branch = getSourceBranch();
    //     if (slug && branch) {
    //         exitCode = await exec(filename, ['app', 'upload', '--token', token, slug, branch]);
    //     }
    // }
    // const doCheck = getInput('check') || true;
    // if (doCheck && exitCode === 0) {
    //     const changedFiles = await getChangedFiles(token);
    //     console.log(`Number of files changed: ${changedFiles.length}`);
    //     if (changedFiles.length === 0) {
    //         console.log('No files changed, skipping Code Limit');
    //     } else {
    //         console.log('Running Code Limit...');
    //         exitCode = await exec(filename, ['check'].concat(changedFiles), {ignoreReturnCode: true});
    //     }
    // }
    // fs.unlinkSync(filename);
    // console.log('Done!');
    // process.exit(exitCode);
}

main();
