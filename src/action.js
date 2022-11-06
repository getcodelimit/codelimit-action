const https = require("https");
const path = require("path");
const fs = require("fs");
const {exec} = require("@actions/exec");

function getBinaryName() {
    let platform = 'macos';
    let envVar = process.env.RUNNER_OS;
    if (envVar) {
        platform = envVar.toLowerCase();
    }
    return {'macos': 'clim-macos', 'windows': 'clim.exe', 'linux': 'clim-linux'}[platform];
}

https.get('https://github.com/getcodelimit/codelimit/releases/latest', (res) => {
    const downloadUrl = res.headers.location.replace('/tag/', '/download/');
    const binaryUrl = `${downloadUrl}/${getBinaryName()}`;
    console.log(binaryUrl);
    https.get(binaryUrl, (res) => {
        https.get(res.headers.location, (res) => {
            const filename = path.join(__dirname, getBinaryName());
            const file = fs.createWriteStream(filename);
            res.pipe(file);
            file.on("finish", () => {
                file.close();
                console.log("Download Completed");
            });
            file
                .on('error', (err) => {
                    console.log(`ERROR: ${err}`);
                }).on('finish', async () => {
                file.close();
                fs.chmodSync(filename, '777');
                const unlink = () => {
                    fs.unlink(filename, (err) => {
                        console.log(`ERROR: ${err}`);
                    });
                };
                await exec(filename)
                    .catch((err) => {
                        console.log(`ERROR: ${err}`);
                    }).then(() => {
                        unlink();
                    });
            });
        });
    });
});