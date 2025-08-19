const express = require('express');
const router = express.Router();
const FarmController = require('../controllers/FarmController');
const { vendorAuth } = require('../middlewares/Auth');
const ParseNest = require('../utils/ParseNest');



// router.post('/book_farm',ParseNest, FarmController.bookFarm);

router.post('/book_farm',ParseNest, FarmController.sendInquiry);

router.get('/get_month_booking', ParseNest, FarmController.getMonthlyFarmBookings);

router.post('/filter_querry_home', ParseNest, FarmController.FilterQueeryHomePage);

router.get('/get_all_categories', ParseNest,FarmController.getFarmCategories);

router.get('/get_all_facilities', ParseNest,FarmController.getUsedFacilities);

router.get('/get_all_types', ParseNest,FarmController.getFarmTypes);

// router.get('/get_all_farms', ParseNest,getAllFarms);

router.post('/get_farm_id', ParseNest,FarmController.getFarmById);

router.post('/filter-farms', ParseNest,FarmController.FilterQueeryFarms);

// gallary Parts apis 

router.post('/get_farm_image_by_category_id', ParseNest,FarmController.getFarmImagesByCategories)

router.post('/get_farm_by_image_url_and_id', ParseNest,FarmController.getFarmByImageUrl);




module.exports = router;
