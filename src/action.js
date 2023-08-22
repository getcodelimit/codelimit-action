const path = require("path");
const fs = require("fs");
const {exec} = require("@actions/exec");
const nodeFetch = require('node-fetch');
const {promisify} = require("util");
const streamPipeline = promisify(require('stream').pipeline);
const {context} = require('@actions/github');
const {Octokit} = require("@octokit/action");


function getBinaryName() {
    let platform = 'linux';
    if (process.env.RUNNER_OS) {
        platform = process.env.RUNNER_OS.toLowerCase();
    } else if (process.platform === 'darwin') {
        platform = 'macos';
    } else if (process.platform === 'win32') {
        platform = 'windows';
    }
    return {'macos': 'codelimit-macos', 'windows': 'codelimit.exe', 'linux': 'codelimit-linux'}[platform];
}

async function getLatestBinaryUrl() {
    const latestUrl = 'https://github.com/getcodelimit/codelimit/releases/latest';
    const res = await nodeFetch(latestUrl);
    const downloadUrl = res.url.replace('/tag/', '/download/');
    return `${downloadUrl}/${getBinaryName()}`;
}

async function getChangedFiles() {
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
    console.log(process.env.INPUT_GITHUB_TOKEN);
    const octokit = new Octokit();
    const response = await octokit.repos.compareCommits({
        base,
        head,
        owner: context.repo.owner,
        repo: context.repo.repo
    });

    console.log(response);
    
    if (response.status !== "200") {
        return ['.'];
    }

    const files = response.data.files
    console.log(files);
    const result = [];
    for (const file of files) {
        const filename = file.filename
        if (file.status === 'modified' || file.status === 'added') {
            result.push(filename);
        }
    }
    console.log(result);
    return result;
}

(async function main() {
    const changedFiles = await getChangedFiles();
    const binaryUrl = await getLatestBinaryUrl();
    console.log(`Downloading Code Limit binary from URL: ${binaryUrl}`);
    const response = await nodeFetch(binaryUrl);
    const filename = path.join(__dirname, getBinaryName());
    console.log(`Code Limit binary downloaded: ${filename}`);
    await streamPipeline(response.body, fs.createWriteStream(filename));
    fs.chmodSync(filename, '777');
    console.log('Running Code Limit...');
    const exitCode = await exec(filename, ['check'].concat(changedFiles), {ignoreReturnCode: true});
    fs.unlinkSync(filename);
    console.log('Done!');
    process.exit(exitCode);
})();