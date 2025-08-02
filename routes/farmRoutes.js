const express = require('express');
const router = express.Router();
const FarmController = require('../controllers/FarmController');
const { vendorAuth } = require('../middlewares/Auth');
const ParseNest = require('../utils/ParseNest');


router.post('/block_date',ParseNest,vendorAuth, FarmController.blockDate);

router.post('/un_block_date',ParseNest,vendorAuth, FarmController.unblockDate);

router.post('/book_farm',ParseNest, FarmController.bookFarm);

router.get('/get_month_booking', ParseNest, FarmController.getMonthlyFarmBookings);

router.post('/filter_querry_home', ParseNest, FarmController.FilterQueeryHomePage);

router.get('/get_all_categories', ParseNest,FarmController.getFarmCategories);

router.get('/get_all_facilities', ParseNest,FarmController.getUsedFacilities);

// router.get('/get_all_farms', ParseNest,getAllFarms);

router.post('/get_farm_id', ParseNest,FarmController.getFarmById);

router.get('/get_farm_by_image_url/:imageurl', ParseNest,FarmController.getFarmByImageUrl);

router.post('/filter-farms', ParseNest,FarmController.FilterQueeryFarms);

// gallary images 

router.post('/get_farm_image_by_category_id', ParseNest,FarmController.getFarmImagesByCategories)




module.exports = router;
