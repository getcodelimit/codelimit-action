const path = require("path");
const fs = require("fs");
const {exec} = require("@actions/exec");
const nodeFetch = require('node-fetch');
const {promisify} = require("util");
const streamPipeline = promisify(require('stream').pipeline)


function getBinaryName() {
    let platform = 'macos';
    let envVar = process.env.RUNNER_OS;
    if (envVar) {
        platform = envVar.toLowerCase();
    }
    return {'macos': 'codelimit-macos', 'windows': 'codelimit.exe', 'linux': 'codelimit-linux'}[platform];
}

async function getLatestBinaryUrl() {
    const latestUrl = 'https://github.com/getcodelimit/codelimit/releases/latest';
    const res = await nodeFetch(latestUrl);
    const downloadUrl = res.url.replace('/tag/', '/download/');
    return `${downloadUrl}/${getBinaryName()}`;
}

(async function main() {
    const binaryUrl = await getLatestBinaryUrl();
    console.log(`Downloading Code Limit binary from URL: ${binaryUrl}`);
    const response = await nodeFetch(binaryUrl);
    const filename = path.join(__dirname, getBinaryName());
    console.log(`Code Limit binary downloaded: ${filename}`);
    await streamPipeline(response.body, fs.createWriteStream(filename));
    fs.chmodSync(filename, '777');
    console.log('Running Code Limit...');
    await exec(filename, ['check', '.']);
    fs.unlinkSync(filename);
    console.log('Done!');
})();