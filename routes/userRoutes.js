const express = require('express');
const router = express.Router();
const helpDeskInquiryController=require("../controllers/helpDeskInquiryController")


router.post('/submit_enquiry',helpDeskInquiryController.submitInquiry);

router.get('/get_all_enquiry',helpDeskInquiryController.getAllInquiries);

module.exports = router;
