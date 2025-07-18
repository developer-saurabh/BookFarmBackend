const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');


router.route('/webhook').get(chatController.receiveMessage).post(chatController.receiveMessage);

module.exports = router;
