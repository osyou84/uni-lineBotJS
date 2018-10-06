'use strict';

const PORT = process.env.PORT || 3000;
const line = require('@line/bot-sdk');
const language = require('@google-cloud/language');
const express = require('express');
const axios = require("axios");
require("dotenv").config();


const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};
const app = express();
const client_line = new line.Client(config);
const client_lang = new language.LanguageServiceClient();


//応答処理
const Analyze = async (text,event,userId) => {
  let replyText = "";
  const document = {
    content: text,
    type: 'PLAIN_TEXT',
  };

  client_lang
  .analyzeSentiment({document: document})
  .then(results => {
    const sentiment = results[0].documentSentiment;
    pushText(`全体評価:\nスコア: ${rounding(sentiment.score)}\n感情の振れ幅: ${rounding(sentiment.magnitude)}`,userId);

    const sentences = results[0].sentences;
    sentences.forEach(sentence => {
      setTimeout(() => {
        pushText(`「${sentence.text.content}」:\nスコア: ${rounding(sentence.sentiment.score)}\n感情の振れ幅: ${rounding(sentence.sentiment.magnitude)}`,userId);
      },1000);
    });

    evalResult(sentiment.score,userId)
  })
  .catch(err => {
    console.error('ERROR:', err);
  });
}

//切り捨て処理
const rounding = (num) =>{
  return Math.floor(num * 10)/10;
}

//テキスト送信処理
const pushText = (mes,userId) => {
  client_line.pushMessage(userId,{
    type: "text",
    text: mes,
  })
}

//総合評価でスタンプ送信
const evalResult = (num,userId) => {
  let stamp = 1;
  if(num === 0){
    stamp = 113
  }else if (num >= 0) {
    stamp = 14;
  }else{
    stamp = 6;
  }
  setTimeout(() => {
    client_line.pushMessage(userId,{
      type: "sticker",
      packageId: 1,
      stickerId: stamp,
    })
  },2000);
}

//LINEイベント発火
const handleEvent = (event) => {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  const sentText = event.message.text;
  const userId = event.source.userId;
  let message = "";

  if(event.message.text !== ""){
    message = `「${sentText}」を解析します...`;
    Analyze(sentText,event,userId);
  }

  return client_line.replyMessage(event.replyToken, {
    type: 'text',
    text: message
  });
}

//main
app.post('/webhook', line.middleware(config), (req, res) => {
  console.log(req.body.events);
  Promise
  .all(req.body.events.map(handleEvent))
  .then((result) => res.json(result));
});
app.listen(PORT);
console.log(`サーバー作動中:PORT ${PORT}`);
