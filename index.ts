import { exec } from "child_process";
import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Files to pass to your parser.sh
// const emailFile = "./email.html";
const systemFile = "./system.txt";


function runParser(emailFile: string) {

    return new Promise<string>((resolve, reject) => {

        // Build the command
        const cmd = `./parser.sh ${emailFile} ${systemFile}`;

        console.log(`Running parser: ${cmd}\n`);

        // Execute the shell script
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`Execution error: ${error.message}`);
                reject(error);
                return;
            }

            if (stderr) {
                console.error(`Stderr: ${stderr}`);
                reject(stderr);
            }

            // Print stdout from parser.sh
            console.log("Parser output:\n");
            console.log(stdout);
            resolve(stdout);
        });

    });

}


const app = express();
const PORT = 3010;

// Parse JSON bodies
// app.use(bodyParser.json());

app.use(express.text({ type: "*/*", limit: "10mb" }));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/parse-email", async (req, res) => {
    const emailHtml = req.body;

    if (!emailHtml) {
        return res.status(400).json({ error: "Missing emailHtml in request body" });
    }

    const tmpFile = `./${crypto.randomUUID()}.html`;

    // Write email HTML to temp file for parser.sh
    // console.log(emailHtml);
    await fs.writeFile(tmpFile, emailHtml);

    // Run the parser
    try {
        const json = await runParser(tmpFile);
        const parsedJson = JSON.parse(json);
        console.log(parsedJson);



        res.json({
            // message: "Received email",
            is_delivery: parsedJson?.is_delivery ?? false,
            identifier: parsedJson?.restaurant_name + " " + parsedJson?.pick_address.street_address,
            job: parsedJson ?? json,
        });
    } catch (error) {
        res.status(500).json({ error: "Error parsing email", details: error });
    } finally {
        fs.rm(tmpFile)
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});