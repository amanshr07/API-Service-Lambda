/*
    Fetching value from Enviroment Variable  
*/
const contentType = process.env.contentType;
const xApiKey = process.env.xApiKey;
const verifyToken = process.env.postUrl;

exports.handler = function(event, context, callback) {

    //Verify the given header
    console.log(event);
    var axios = require('axios');
    //Formatting Json for Post request
    const data = {
        token: event.headers.Authorization.substring(7, event.headers.Authorization.length),
    };
    //Adding header for Post request
    const headers = {
        'Content-Type': contentType,
        'x-api-key': xApiKey
    };
    console.info("Initiating Post Request to : " + verifyToken);
    axios.post(verifyToken, data, {
            headers: headers
        })
        .then((response) => {
            console.log(response.data.error);
            switch (response.data.error) {
                //If you are authoried authorizated user
                case false:
                    console.info("The given User is valid");
                    callback(null, generatePolicy('user', 'Allow', event.methodArn));
                    break;
                    //If you are un-authoried authorizated user    
                case true:
                    console.info("The given User is Invalid");
                    callback(null, generatePolicy('user', 'Deny', event.methodArn));
                    break;
                default:
                    console.log("Invalid token");
                    callback("Error: Invalid token"); // Return a 500 Invalid token response
            }
        }).catch((err) => {
            throw new Error("Error while calling Post API",err);
        });


};

// Help function to generate an IAM policy
var generatePolicy = function(principalId, effect, resource) {
    console.info("principalId",principalId);
    console.info("effect",effect);
    console.info("resource",resource);
    var authResponse = {};

    authResponse.principalId = principalId;
    if (effect && resource) {
        var policyDocument = {};
        policyDocument.Version = '2012-10-17';
        policyDocument.Statement = [];
        var statementOne = {};
        statementOne.Action = 'execute-api:Invoke';
        statementOne.Effect = effect;
        statementOne.Resource = resource;
        policyDocument.Statement[0] = statementOne;
        authResponse.policyDocument = policyDocument;
    }
    return authResponse;
}