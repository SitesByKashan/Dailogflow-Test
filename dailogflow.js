const express = require('express');
const bodyParser = require('body-parser');
const { WebhookClient } = require('dialogflow-fulfillment');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const MODEL_NAME = "gemini-1.5-pro-latest";
const API_KEY = process.env.API_KEY; // Replace with your actual API key
const accountSid = process.env.accountSid;
const authToken = process.env.authToken;
const client = require('twilio')(accountSid, authToken);
const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use((req, res, next) => {
    console.log(`Path ${req.path} with Method ${req.method}`);
    next();
});

app.get('/', (req, res) => {
    res.send("Status Okay");
});

app.post('/dialogflow', async (req, res) => {
    var id = (res.req.body.session).substr(43);
    console.log(id);
    const agent = new WebhookClient({ request: req, response: res });

    async function fallback(agent) {
        let action = req.body.queryResult.action;
         let queryText = req.body.queryResult.queryText;
        if (action === 'input.unknown') {
            let result = await runChat(queryText);
            agent.add(result);
            console.log(result)
        } else {
            agent.add(result);
            console.log(result)
        }
    }

    async function emailHandler(agent) {
        console.log(`intent  =>  email`);
        const { Name, address, email, phone, nic, qualification, Gender, date, city } = agent.parameters;
        var transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'mkashan2585@gmail.com', // Replace with your email
                pass: 'vvimvqoydrvqctyk'  // Replace with your email password
            }
        });
        agent.add("Welcome to Saylani Mass IT Training Admission Information Chatbot.... Now Enter your Name");
        var mailOptions = {
            from: 'mkashan2585@gmail.com', // Replace with your email
            to:  `${email}, hammadn788@gmail.com`,
            subject: 'Saylani Admission Information',
            html: `<div style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #e6f2ff; width: 100vh; display: flex; justify-content: center; align-items: center; height: 100vh;">
                <div style="background-color: #ffffff; width: 100%; max-width: 600px; border-radius: 10px; box-shadow: 0 0 15px rgba(0, 0, 0, 0.1); text-align: center; justify-content: center; padding: 20px; box-sizing: border-box;">
                    
                    <h1 style="font-size: 2rem; margin: 10px 0; color: #007acc; text-align: center; justify-content: center;">SAYLANI MASS IT TRAINING</h1>
                    <p style="margin: 5px 0; color: #333333; font-size: 1rem;">GenAI Chatbot</p>
                    <div style="margin-top: 20px; text-align: left; font-size: 1rem;">
                        <div style="margin: 10px 0; color: #007acc;"><span style="font-weight: bold; color: black;">Name:</span> ${Name}</div>
                        <div style="margin: 10px 0; color: #007acc;"><span style="font-weight: bold; color: black;">Email:</span> ${email}</div>
                        <div style="margin: 10px 0; color: #007acc;"><span style="font-weight: bold; color: black;">Phone:</span> ${phone}</div>
                        <div style="margin: 10px 0; color: #007acc;"><span style="font-weight: bold; color: black;">Address:</span> ${address}</div>
                        <div style="margin: 10px 0; color: #007acc;"><span style="font-weight: bold; color: black;">NIC:</span> ${nic}</div>
                        <div style="margin: 10px 0; color: #007acc;"><span style="font-weight: bold; color: black;">Qualification:</span> ${qualification}</div>
                        <div style="margin: 10px 0; color: #007acc;"><span style="font-weight: bold; color: black;">Gender:</span> ${Gender}</div>
                        <div style="margin: 10px 0; color: #007acc;"><span style="font-weight: bold; color: black;">Date Of Birth:</span> ${date}</div>
                        <div style="margin: 10px 0; color: #007acc;"><span style="font-weight: bold; color: black;">City:</span> ${city}</div>
                    </div>
                </div>
            </div>`
           
        };
        agent.add("Your Information has been successfully sent to the administration!");
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        });
    }

    async function runChat(queryText) {
        const genAI = new GoogleGenerativeAI(API_KEY);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });

        const generationConfig = {
            temperature: 1,
            topK: 0,
            topP: 0.95,
            maxOutputTokens: 100,
        };

        const chat = model.startChat({
            generationConfig,
            history: [],
        });

        const result = await chat.sendMessage(queryText);
        const response = result.response;
        return response.text();
    }

    let intentMap = new Map();
    intentMap.set('Default Welcome Intent', emailHandler);
    intentMap.set('Default Fallback Intent', fallback);
    intentMap.set('Information-Card', emailHandler); // Ensure this matches the intent name in Dialogflow

    agent.handleRequest(intentMap);
});


// Twilio voice webhook to handle incoming calls
app.post('/voice', (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();
    const gather = twiml.gather({
        input: 'speech',
        action: '/handle-gather',
        speechTimeout: 'auto',
    });

    gather.say('Welcome to the Dialogflow telephony integration. How can I help you today?');

    res.type('text/xml');
    res.send(twiml.toString());
});

// Handle speech input and forward it to Dialogflow
app.post('/handle-gather', async (req, res) => {
    const transcript = req.body.SpeechResult;

    const dialogflowRequest = {
        session: `projects/${process.env.DIALOGFLOW_PROJECT_ID}/agent/sessions/${req.body.CallSid}`,
        queryInput: {
            text: {
                text: transcript,
                languageCode: 'en-US',
            },
        },
    };

    const dialogflowClient = new dialogflow.SessionsClient();
    const responses = await dialogflowClient.detectIntent(dialogflowRequest);
    const result = responses[0].queryResult;

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(result.fulfillmentText);

    res.type('text/xml');
    res.send(twiml.toString());
});

app.listen(PORT, () => {
    console.log(`Server is up and running at http://localhost:${PORT}/`);
});
