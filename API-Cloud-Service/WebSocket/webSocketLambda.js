const AWS = require('aws-sdk');
const connectionTable = process.env.connectionTable;
const dynamodb = new AWS.DynamoDB.DocumentClient();
const apig = new AWS.ApiGatewayManagementApi({
  endpoint: process.env.GatewayEndpoint
});
var sqs = new AWS.SQS();
exports.handler = async function (event, context) {
  if (event.Records != null) {
    var records = event.Records;
    for (const record of records) {
      console.log(record.body);
      console.info("Post to queue Triggered");
      try{
      var obj = JSON.parse(record.body);
      console.info("Message body extracted");
      }catch(e) {
       console.log("Body is Incorrect and Cant be parsed");
    }
      var receipt_handle = record.receiptHandle;
      var receipt = {
            QueueUrl: process.env.QueueUrl,
            ReceiptHandle: receipt_handle
          };
      await sqs.deleteMessage(receipt).promise();
      console.info("SQS Queue is cleared");
      if(typeof obj !== 'undefined'){
      var tenant = obj.tenant_id;
      var occEvent = obj.event;
      var params = {
        TableName: connectionTable,
        IndexName: "tenantId-index",
        KeyConditionExpression: "tenantId = :t_id",
        FilterExpression: "contains (Event, :e)",
        ExpressionAttributeValues: {
          ':t_id': tenant,
          ':e': occEvent
        },
        ProjectionExpression: "connectionId"
      };
      var result = await dynamodb.query(params).promise();
      console.info("Connections Id received");
      for (const items of result.Items) {
        var id = items.connectionId;
        try {
          await apig.postToConnection({
            'ConnectionId': id,
            'Data': Buffer.from(JSON.stringify(obj))
          }).promise();
        } catch (err) {
          console.info("No open connection found \n Hence Deleting id:-");
          console.info(id);
          await dynamodb.delete({
            TableName: connectionTable,
            Key: { 'connectionId': id }
          }).promise();
        }
      }
      console.info("Post to connections completed");
    }
    }
  }
  else {
    const { body, requestContext: { connectionId, routeKey } } = event;
    switch (routeKey) {
      case '$connect':
        console.info("Creating new connection and storing in database");
        try {
          await dynamodb.put({
            TableName: connectionTable,
            Item: {
              connectionId
            }
          }).promise();
        } catch (err) {
          return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
        }
        break;
      case '$disconnect':
        console.info("Disconnecting connection and deleting from database");
        try {
          await dynamodb.delete({
            TableName: connectionTable,
            Key: { connectionId }
          }).promise();
        } catch (err) {
          return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
        }
        break;
      case 'onSubscribe':
        console.info("Updating the received connection and storing in database");
        try {
          const obj = JSON.parse(body);
          await dynamodb.update({
            TableName: connectionTable,
            Key: { connectionId },
            UpdateExpression: "set tenantId = :t_id,Event = :e",
            ExpressionAttributeValues: {
              ":t_id": obj.data.tenant_id,
              ":e": obj.data.event
            },
            ReturnValues: "UPDATED_NEW"
          }).promise();
        } catch (err) {
          return { statusCode: 500, body: 'Failed to connect: ' + JSON.stringify(err) };
        }
      case '$default':
      default:
    }
    return { statusCode: 200, body: JSON.stringify("Connected")};
  }
};




