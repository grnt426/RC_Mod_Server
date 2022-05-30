import express from 'express';
import GoogleSpreadsheet from 'google-spreadsheet';
import cors from 'cors';
import * as fs from "fs";
const {Console} = console;

const app = express();
const sheets = {};

const creds = JSON.parse(fs.readFileSync('uploader.json', 'utf8'));

app.get("/health", (req, res) => {
    res.status(200);
    res.send("Health Check Passed\n");
});

app.post("/income_update", cors(), async(req, res) => {
    var body = '';
    req.on('data', function(data) {
        body += data
    });
    req.on('end', async function() {
        console.info("Received income data");

        try {
            const payload = JSON.parse(body);
            const resources = payload.resources;
            const cells = payload.cell_locations;
            const instance = payload.instance;
            const sheetID = payload.sheet;

            // We can make this better in the future. More Async
            if(!sheets[sheetID]) {
                sheets[sheetID] = (await loadGoogleSheet(sheetID)).sheetsByIndex[0];
                await sheets[sheetID].loadCells('B2:D3');
            }
            const sheet = sheets[sheetID];

            sheet.getCellByA1(cells.income_total).value = resources.cred.value;
            sheet.getCellByA1(cells.tech_total).value = resources.tech.value;
            sheet.getCellByA1(cells.ideo_total).value = resources.ideo.value;
            sheet.getCellByA1(cells.income_rate).value = resources.cred.change;
            sheet.getCellByA1(cells.tech_rate).value = resources.tech.change;
            sheet.getCellByA1(cells.ideo_rate).value = resources.ideo.change;
            sheet.saveUpdatedCells().then(r => {
                if(r) {
                    console.info(new Date().toISOString() + " Failed: " + r);
                    res.writeHead(500, {'Content-Type': 'text/html'});
                    res.end("Error in writing to Sheets");
                    console.error("Response from Sheets after saving player income: " + r);
                }
                else {
                    console.info(new Date().toISOString() + "Processed successfully.");
                    res.writeHead(200, {'Content-Type': 'text/html'});
                    res.end('received');
                }
            })
                .catch(e => {
                    console.info(new Date().toISOString() + " Error: " + e);
                    res.writeHead(500, {'Content-Type': 'text/html'});
                    res.end("Failure in talking to Google Sheets");
                });
        }
        catch(err) {
            console.error(new Date().toISOString() + " Failed: " + err);
            res.writeHead(500, {'Content-Type': 'text/html'});
            res.end("Failure in processing request: " + err);
        }
    });
});

async function loadGoogleSheet(id) {
    const doc = new GoogleSpreadsheet.GoogleSpreadsheet(id);
    await doc.useServiceAccountAuth({
        client_email: creds.client_email,
        private_key: creds.private_key,
    });

    await doc.loadInfo(); // loads document properties and worksheets
    console.info(doc.title + " sheet loaded");

    return doc;
}

const server = app.listen(8443, () => {
    console.info("Server started");
});

// handle shutdowns gracefully
process.on('SIGTERM', () => {
    console.log('!!! Shutting Down !!!');
    server.close(() => {
        process.exit(0);
    });
});