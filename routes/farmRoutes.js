const express = require('express');
const router = express.Router();
const { addFarm, bookFarm, getMonthlyFarmBookings, FilterQueeryHomePage, getFarmCategories, getAllFarms, getFarmById, getFarmByImageUrl } = require('../controllers/FarmController');
const { vendorAuth } = require('../middlewares/vendorAuth');
const ParseNest = require('../utils/ParseNest');

router.post('/add_Farm',ParseNest,vendorAuth, addFarm);

router.post('/book_farm',ParseNest, bookFarm);

router.get('/get_month_booking', ParseNest, getMonthlyFarmBookings);

router.post('/filter_querry_home', ParseNest, FilterQueeryHomePage);

router.get('/get_all_categories', ParseNest,getFarmCategories);

router.get('/get_all_farms', ParseNest,getAllFarms);

router.get('/get_farm_id/:id', ParseNest,getFarmById);

router.get('/get_farm_by_image_url', ParseNest,getFarmByImageUrl);




module.exports = router;
