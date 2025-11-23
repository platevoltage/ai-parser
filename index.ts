import { exec } from "child_process";
import express from "express";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import qs from "qs";
import { Mistral } from "@mistralai/mistralai";
import { dir } from "console";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Files to pass to your parser.sh
// const emailFile = "./email.html";
const systemFile = "./system.txt";


const mistral = new Mistral({
    apiKey: process.env.MISTRAL_KEY,
});
//usage: { promptTokens: 865, completionTokens: 559, totalTokens: 1424 },  
async function runMistral(message: string) {
    // const message = await fs.readFile(emailFile, "utf-8");
    const systemPrompt = await fs.readFile(systemFile, "utf-8");
    const result = await mistral.chat.complete({
        model: "ministral-3b-latest",
        temperature: 0,
        responseFormat: { type: "json_object" },
        messages: [
            { content: systemPrompt, role: "system" },
            {
                content: message,
                role: "user",
            },
        ],
    });

    console.log(result);
    return result.choices[0].message.content;
}



function runParser(emailFile: string) {

    return new Promise<string>((resolve, reject) => {

        const cmd = `./parser.sh ${emailFile} ${systemFile}`;

        console.log(`Running parser: ${cmd}\n`);

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

            resolve(stdout);
        });

    });

}


const app = express();
const PORT = 3010;

// Parse JSON bodies
// app.use(bodyParser.json());


app.use(express.json({ limit: "10mb" }));
app.use(express.text({ type: "*/*", limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));


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
        const text = await runParser(tmpFile);
        const json = await runMistral(text) as string;
        const parsedJson = JSON.parse(json);
        // console.log(parsedJson);

        await fs.mkdir(`./output/${parsedJson?.restaurant_name}`, { recursive: true });
        await fs.writeFile(`./output/${parsedJson?.restaurant_name}/${new Date().toISOString()}.html`, emailHtml);
        await fs.writeFile(`./output/${parsedJson?.restaurant_name}/${new Date().toISOString()}.json`, JSON.stringify({
            is_delivery: parsedJson?.is_delivery ?? false,
            identifier: parsedJson?.restaurant_name + " " + parsedJson?.pick_address.street_address,
            job: parsedJson ?? json,
        }, null, 2));


        res.json({
            // message: "Received email",
            is_delivery: parsedJson?.is_delivery ?? false,
            identifier: parsedJson?.restaurant_name + " " + parsedJson?.pick_address.street_address,
            job: parsedJson ?? json,
        });
    } catch (error) {
        res.status(500).json({ error: "Error parsing email", details: error });
    } finally {
        fs.rm(tmpFile);

    }
});


app.post("/parse-email-mailgun", async (req, res) => {
    // await fs.writeFile('./req.txt', req.body);
    const request = qs.parse(req.body);
    // await fs.writeFile('./reqParsed.txt', req.body);
    let emailHtml = request["body-html"] as string;
    if (!emailHtml) {
        emailHtml = request["body-text"] as string;
    }
    console.log(emailHtml);
    const intakeEmail = request["X-Forwarded-To"] as string;
    const subject = request["Subject"] as string;
    const oldJob = request["old-results"] as string;
    if (oldJob) {
        console.error("HEY!!!", oldJob);
    } else {
        console.error("no old job");
    }

    const tmpFile = `./${crypto.randomUUID()}.html`;

    // Write email HTML to temp file for parser.sh
    // console.log(emailHtml);
    await fs.writeFile(tmpFile, emailHtml);

    // Run the parser
    try {
        const text = await runParser(tmpFile);
        const textMinified = text.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n'); // collapse double newlines
        const json = await runMistral(textMinified) as string;
        const parsedJson = JSON.parse(json);
        console.log(parsedJson.restaurant_name);

        let dirName = `./output/${parsedJson?.restaurant_name}`;


        await fs.mkdir(dirName, { recursive: true });

        if (parsedJson?.is_delivery) {
            dirName += "/parsed";
            await fs.mkdir(dirName, { recursive: true });
        } else {
            dirName += "/ignored";
            await fs.mkdir(dirName, { recursive: true });
        }
        const dateStamp = new Date().toISOString();
        dirName += "/" + dateStamp;
        await fs.mkdir(dirName, { recursive: true });
        await fs.writeFile(`${dirName}/email.html`, emailHtml);

        const response = {
            subject: subject,
            intake_email: intakeEmail,
            is_delivery: parsedJson?.is_delivery ?? false,
            identifier: parsedJson?.restaurant_name + " " + parsedJson?.pick_address.street_address,
            job: parsedJson ?? json,
        }


        await fs.writeFile(`${dirName}/ai-parsed.json`, JSON.stringify(response, null, 2));

        if (oldJob) {
            await fs.writeFile(`${dirName}/old-job.json`, JSON.stringify(JSON.parse(oldJob), null, 2));
        }


        res.json(response);
    } catch (error) {
        res.status(500).json({ error: "Error parsing email", details: error });
    } finally {
        fs.rm(tmpFile);

    }
});


app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});