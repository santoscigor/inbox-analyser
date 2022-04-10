const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = 'token.json';

fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);

    authorize(JSON.parse(content), countsEmailsSenders);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);

        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });

    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);

            oAuth2Client.setCredentials(token);
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

/**
 * Counts the email size in the user's account.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function countsEmailsSenders(auth) {
    const gmail = google.gmail({ version: 'v1', auth });
    gmail.users.messages.list({
        userId: "me",
        includeSpamTrash: true,
        maxResults: 100
    }, (err, res) => {
        if (err) return console.log('The API returned an error listing messages: ' + err);

        let mailAuthorsCounter = {};
        const messages = res.data.messages;

        try {
            messages.map(message => {
                gmail.users.messages.get({ userId: "me", id: message.id }, async (err, message) => {

                    if (err)
                        throw new Error('The API returned an error getting message: ' + err);

                    const headers = message.data.payload.headers;
                    const mailAuthors = headers.filter(header => { return header.name == 'From'; });
                    console.log(mailAuthors);

                    if (!mailAuthorsCounter[mailAuthors[0]]) {
                        mailAuthorsCounter[mailAuthors[0].value] = 1;
                    } else {
                        mailAuthorsCounter[mailAuthors[0].value] += 1;
                    }

                });

                return mailAuthorsCounter;
            });

        } catch (error) {
            console.log(error);
        }

    })
}
