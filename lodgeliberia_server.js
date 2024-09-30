// Intializing/Creating Server
const express = require('express');
const session = require('express-session');
const server = express();
const port = 5600;
const QRCode = require('qrcode');
// =======================
// Extended Modules Integration
const path = require("path");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3");
const multer = require("multer");
// ============================================

// Static files render configurations
server.use('/public', express.static(__dirname + '/public/'));

// Set EJS as the templating engine
server.set('view engine', 'ejs');
server.use(express.json());

// parse application/x-www-form-urlencoded
server.use(bodyParser.urlencoded({ extended: true })) /* This process form with multi-parts */

// Setting up express-session (configuration)
server.use(session({
    secret: '0778544709Ja@',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false // Set to true if you're using HTTPS
    }
}));


// Database Creation
const lodge_liberia_db = new sqlite3.Database(__dirname + '/database/lodgeliberia.db');

// Setup storage for storing files
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Database Creation Section
// Initialize/Create Database Tables if not exist
function initializeDatabase() {
    lodge_liberia_db.serialize(() => {
        const tables = [
            `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL,
                fullname TEXT NOT NULL,
                phone_number INTEGER NOT NULL,
                email TEXT UNIQUE,
                username TEXT NOT NULL,
                password TEXT Not Null,
                profile_picture BLOB,
                time_created DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS host_listings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                title TEXT NOT NULL,
                description TEXT,
                detail_description TEXT,
                location TEXT NOT NULL,
                price_per_night REAL NOT NULL,
                max_guests INTEGER,
                amenities TEXT,
                available_from DATE,
                available_to DATE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                IMAGES BLOB NOT NULL,
                county TEXT NOT NULL,
                city Text NOT NULL,
                property_type TEXT NOT NULL,
                min_stay_days INTEGER,
                max_guest INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`,
            `CREATE TABLE IF NOT EXISTS host_images (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                host_listing_id INTEGER,
                image_data BLOB,
                FOREIGN KEY (host_listing_id) REFERENCES host_listings(id)
            )`,
            `CREATE TABLE IF NOT EXISTS places_features (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                feature TEXT,
                feature_type TEXT,
                feature_description TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS host_places_features (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                place_id INTEGER,
                feature TEXT,
                feature_type TEXT,
                feature_description TEXT,
                FOREIGN KEY (place_id) REFERENCES host_listings(id)
            )`
        ];

        tables.forEach(query => {
            lodge_liberia_db.run(query, (err) => {
                if (err) {
                    console.error(err.message);
                }
            });
        });
    });
}

// Initialize database
initializeDatabase();


// === Post methods
// This route is for calculating the output cost for the total amount of days booked
server.post('/calculate-price', (req, res) => {
    const { startDate, endDate, propertyPricePerNight } = req.body;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Calculate the number of days between the two dates
    const daysBetween = Math.floor((end - start) / (1000 * 3600 * 24));

    if (daysBetween < 0) {
        // Handle the case where the end date is before the start date
        return res.json({ totalPrice: 0 });
    }

    // Calculate the total price
    const totalPrice = daysBetween * propertyPricePerNight;
    totalPrice.toFixed(2);

    // Calculate the lodgeliberia Percentage
    const lodge_liberia_percent = 0.1 * totalPrice;

    // Total plus percentage
    const total_plus_percentage = totalPrice + lodge_liberia_percent;

    // Send back the total price as JSON
    res.json({ totalPrice, lodge_liberia_percent, total_plus_percentage });
});

// signup form post route
server.post('/signup', (req, res) => {
    const { fullname, phone_number, email, username, password } = req.body;

    // Insert the new user data into the 'users' table
    const sql = `
    INSERT INTO users (role, fullname, phone_number, email, username, password)
    VALUES (?, ?, ?, ?, ?,?)
    `;

    // Run the SQL query
    lodge_liberia_db.run(sql, ["guest", fullname, phone_number, email, username, password], function (err) {
        if (err) {
            console.error('Error inserting user into database:', err);
            return res.status(500).send('Error registering user');
        }

        console.log(`User ${username} successfully registered.`);
        res.redirect('/login');
    });
});

// Login form post route
// POST route for login
server.post('/login', (req, res) => {
    const { username, password } = req.body;

    // SQL query to find user
    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';

    lodge_liberia_db.get(sql, [username, password], (err, user) => {
        if (err) {
            return res.status(500).send('Internal Server Error');
        }

        if (user) {
            // User is authenticated
            req.session.user = user; // Store user info in session

            // Redirect to the original page or homepage
            const redirectTo = req.session.returnTo || '/';
            delete req.session.returnTo; // Clear stored URL after redirect
            res.redirect(redirectTo);
        } else {
            // User not found: return error message
            res.render('login_signup', { errorMessage: 'Invalid username or password.' }); // Correctly render login view with error message
        }
    });
});



// Post Methods ********


// ==== Get methods

// login pAGE
server.get("/login", (req, res) => {
    res.render('login_signup', { errorMessage: null }); // Pass errorMessage as null or '' initially
});


// Home page route
server.get("/", (req, res) => {
    // Queries object contains different queries for various property types.
    const queries = {
        // Query to get all places available for booking
        allPlaces: `
            SELECT 
                users.fullname AS host_name,
                host_listings.title AS property_title,
                host_listings.id AS property_id,
                host_listings.description AS property_description,
                host_listings.price_per_night AS property_price_per_night,
                host_listings.Images AS images,
                host_listings.available_from,
                -- Formatting the available_from date for better readability
                CASE strftime('%m', host_listings.available_from)
                    WHEN '01' THEN 'January'
                    WHEN '02' THEN 'February'
                    WHEN '03' THEN 'March'
                    WHEN '04' THEN 'April'
                    WHEN '05' THEN 'May'
                    WHEN '06' THEN 'June'
                    WHEN '07' THEN 'July'
                    WHEN '08' THEN 'August'
                    WHEN '09' THEN 'September'
                    WHEN '10' THEN 'October'
                    WHEN '11' THEN 'November'
                    WHEN '12' THEN 'December'
                END AS available_month,
                strftime('%d', host_listings.available_from) AS available_day,
                strftime('%Y', host_listings.available_from) AS available_year
            FROM users
            JOIN host_listings ON users.id = host_listings.user_id
        `,
        // Query to get only apartments (where property_type is 'Apartment')
        apartments: `
            SELECT 
                users.fullname AS host_name,
                host_listings.title AS property_title,
                host_listings.id AS property_id,
                host_listings.description AS property_description,
                host_listings.price_per_night AS property_price_per_night,
                host_listings.Images AS images,
                host_listings.available_from,
                -- Formatting the available_from date for better readability
                CASE strftime('%m', host_listings.available_from)
                    WHEN '01' THEN 'January'
                    WHEN '02' THEN 'February'
                    WHEN '03' THEN 'March'
                    WHEN '04' THEN 'April'
                    WHEN '05' THEN 'May'
                    WHEN '06' THEN 'June'
                    WHEN '07' THEN 'July'
                    WHEN '08' THEN 'August'
                    WHEN '09' THEN 'September'
                    WHEN '10' THEN 'October'
                    WHEN '11' THEN 'November'
                    WHEN '12' THEN 'December'
                END AS available_month,
                strftime('%d', host_listings.available_from) AS available_day,
                strftime('%Y', host_listings.available_from) AS available_year
            FROM users
            JOIN host_listings ON users.id = host_listings.user_id
            WHERE host_listings.property_type = 'Apartment'
        `,
        // Query to get only houses (where property_type is 'House')
        houses: `
            SELECT 
                users.fullname AS host_name,
                host_listings.title AS property_title,
                host_listings.id AS property_id,
                host_listings.description AS property_description,
                host_listings.price_per_night AS property_price_per_night,
                host_listings.Images AS images,
                host_listings.available_from,
                -- Formatting the available_from date for better readability
                CASE strftime('%m', host_listings.available_from)
                    WHEN '01' THEN 'January'
                    WHEN '02' THEN 'February'
                    WHEN '03' THEN 'March'
                    WHEN '04' THEN 'April'
                    WHEN '05' THEN 'May'
                    WHEN '06' THEN 'June'
                    WHEN '07' THEN 'July'
                    WHEN '08' THEN 'August'
                    WHEN '09' THEN 'September'
                    WHEN '10' THEN 'October'
                    WHEN '11' THEN 'November'
                    WHEN '12' THEN 'December'
                END AS available_month,
                strftime('%d', host_listings.available_from) AS available_day,
                strftime('%Y', host_listings.available_from) AS available_year
            FROM users
            JOIN host_listings ON users.id = host_listings.user_id
            WHERE host_listings.property_type = 'House'
        `,

        // Query to get only Guest Houses (where property_type is 'Guest House')
        guest_houses: `
            SELECT 
                users.fullname AS host_name,
                host_listings.title AS property_title,
                host_listings.id AS property_id,
                host_listings.description AS property_description,
                host_listings.price_per_night AS property_price_per_night,
                host_listings.Images AS images,
                host_listings.available_from,
                -- Formatting the available_from date for better readability
                CASE strftime('%m', host_listings.available_from)
                    WHEN '01' THEN 'January'
                    WHEN '02' THEN 'February'
                    WHEN '03' THEN 'March'
                    WHEN '04' THEN 'April'
                    WHEN '05' THEN 'May'
                    WHEN '06' THEN 'June'
                    WHEN '07' THEN 'July'
                    WHEN '08' THEN 'August'
                    WHEN '09' THEN 'September'
                    WHEN '10' THEN 'October'
                    WHEN '11' THEN 'November'
                    WHEN '12' THEN 'December'
                END AS available_month,
                strftime('%d', host_listings.available_from) AS available_day,
                strftime('%Y', host_listings.available_from) AS available_year
            FROM users
            JOIN host_listings ON users.id = host_listings.user_id
            WHERE host_listings.property_type = 'Guest House'
        `,

        // Query to get only Rooms (where property_type is 'Room')
        rooms: `
            SELECT 
                users.fullname AS host_name,
                host_listings.title AS property_title,
                host_listings.id AS property_id,
                host_listings.description AS property_description,
                host_listings.price_per_night AS property_price_per_night,
                host_listings.Images AS images,
                host_listings.available_from,
                -- Formatting the available_from date for better readability
                CASE strftime('%m', host_listings.available_from)
                    WHEN '01' THEN 'January'
                    WHEN '02' THEN 'February'
                    WHEN '03' THEN 'March'
                    WHEN '04' THEN 'April'
                    WHEN '05' THEN 'May'
                    WHEN '06' THEN 'June'
                    WHEN '07' THEN 'July'
                    WHEN '08' THEN 'August'
                    WHEN '09' THEN 'September'
                    WHEN '10' THEN 'October'
                    WHEN '11' THEN 'November'
                    WHEN '12' THEN 'December'
                END AS available_month,
                strftime('%d', host_listings.available_from) AS available_day,
                strftime('%Y', host_listings.available_from) AS available_year
            FROM users
            JOIN host_listings ON users.id = host_listings.user_id
            WHERE host_listings.property_type = 'Room'
        `,

        // Query to get only experiences (where property_type is 'experience')
        experiences: `
            SELECT 
                users.fullname AS host_name,
                host_listings.title AS property_title,
                host_listings.id AS property_id,
                host_listings.description AS property_description,
                host_listings.price_per_night AS property_price_per_night,
                host_listings.Images AS images,
                host_listings.available_from,
                -- Formatting the available_from date for better readability
                CASE strftime('%m', host_listings.available_from)
                    WHEN '01' THEN 'January'
                    WHEN '02' THEN 'February'
                    WHEN '03' THEN 'March'
                    WHEN '04' THEN 'April'
                    WHEN '05' THEN 'May'
                    WHEN '06' THEN 'June'
                    WHEN '07' THEN 'July'
                    WHEN '08' THEN 'August'
                    WHEN '09' THEN 'September'
                    WHEN '10' THEN 'October'
                    WHEN '11' THEN 'November'
                    WHEN '12' THEN 'December'
                END AS available_month,
                strftime('%d', host_listings.available_from) AS available_day,
                strftime('%Y', host_listings.available_from) AS available_year
            FROM users
            JOIN host_listings ON users.id = host_listings.user_id
            WHERE host_listings.property_type = 'Experience'
        `,

        // Additional queries for other property types (e.g., rooms, studios) can be added here.
    };

    // Empty object to hold the results of all queries
    const results = {};

    // First query to get all places
    lodge_liberia_db.all(queries.allPlaces, [], (err, allPlacesRows) => {
        if (err) throw err;

        // Process the rows and map them into a cleaner format with base64 encoded images
        results.allPlaces = allPlacesRows.map(row => ({
            host_name: row.host_name,
            host_place_id: row.property_id,
            property_title: row.property_title,
            property_description: row.property_description,
            property_price_per_night: row.property_price_per_night,
            available_month: row.available_month,
            available_day: row.available_day,
            available_year: row.available_year,
            // Convert BLOB image data to Base64 (if available)
            base64Image: row.images ? Buffer.from(row.images).toString('base64') : null
        }));

        // Second query to get only apartments
        lodge_liberia_db.all(queries.apartments, [], (err, apartmentsRows) => {
            if (err) throw err;

            // Process apartment rows and store in results object
            results.apartments = apartmentsRows.map(row => ({
                host_name: row.host_name,
                host_place_id: row.property_id,
                property_title: row.property_title,
                property_description: row.property_description,
                property_price_per_night: row.property_price_per_night,
                available_month: row.available_month,
                available_day: row.available_day,
                available_year: row.available_year,
                // Convert BLOB image data to Base64 (if available)
                base64Image: row.images ? Buffer.from(row.images).toString('base64') : null
            }));

            // Third query to get only houses
            lodge_liberia_db.all(queries.houses, [], (err, housesRows) => {
                if (err) throw err;

                // Process house rows and store in results object
                results.houses = housesRows.map(row => ({
                    host_name: row.host_name,
                    host_place_id: row.property_id,
                    property_title: row.property_title,
                    property_description: row.property_description,
                    property_price_per_night: row.property_price_per_night,
                    available_month: row.available_month,
                    available_day: row.available_day,
                    available_year: row.available_year,
                    // Convert BLOB image data to Base64 (if available)
                    base64Image: row.images ? Buffer.from(row.images).toString('base64') : null
                }));

                // Fourth query to get only Guest Houses
                lodge_liberia_db.all(queries.guest_houses, [], (err, guest_houses_Rows) => {
                    if (err) throw err;

                    // Process Guest Houses rows and store in results object
                    results.guest_houses = guest_houses_Rows.map(row => ({
                        host_name: row.host_name,
                        host_place_id: row.property_id,
                        property_title: row.property_title,
                        property_description: row.property_description,
                        property_price_per_night: row.property_price_per_night,
                        available_month: row.available_month,
                        available_day: row.available_day,
                        available_year: row.available_year,
                        // Convert BLOB image data to Base64 (if available)
                        base64Image: row.images ? Buffer.from(row.images).toString('base64') : null
                    }));

                    // Fifth query to get only Rooms
                    lodge_liberia_db.all(queries.rooms, [], (err, rooms_Rows) => {
                        if (err) throw err;

                        // Process Rooms rows and store in results object
                        results.rooms = rooms_Rows.map(row => ({
                            host_name: row.host_name,
                            host_place_id: row.property_id,
                            property_title: row.property_title,
                            property_description: row.property_description,
                            property_price_per_night: row.property_price_per_night,
                            available_month: row.available_month,
                            available_day: row.available_day,
                            available_year: row.available_year,
                            // Convert BLOB image data to Base64 (if available)
                            base64Image: row.images ? Buffer.from(row.images).toString('base64') : null
                        }));

                        // Sixth query to get only Experiences
                        lodge_liberia_db.all(queries.experiences, [], (err, experiences_Rows) => {
                            if (err) throw err;

                            // Process Guest Houses rows and store in results object
                            results.experiences = experiences_Rows.map(row => ({
                                host_name: row.host_name,
                                host_place_id: row.property_id,
                                property_title: row.property_title,
                                property_description: row.property_description,
                                property_price_per_night: row.property_price_per_night,
                                available_month: row.available_month,
                                available_day: row.available_day,
                                available_year: row.available_year,
                                // Convert BLOB image data to Base64 (if available)
                                base64Image: row.images ? Buffer.from(row.images).toString('base64') : null
                            }));

                            // All queries are done; pass the results to the EJS template
                            res.render('lodgeliberia_home', {
                                allPlaces: results.allPlaces,  // Contains all places
                                apartments: results.apartments, // Contains only apartments
                                houses: results.houses, // Contains only houses
                                guest_houses: results.guest_houses,  // Contains only Guest Houses
                                rooms: results.rooms,  // Contains only Rooms
                                experiences: results.experiences,  // Contains only Experiences
                                user: req.session.user  // Pass session user to the template if logged in
                            });
                        });

                    });

                });
            });
        });
    });
});


// Search Results Route
server.get("/search_result", (req, res) => {

    // Pulling requested search credentials from search form
    const place_location_address = req.query.place_location;
    const place_price = req.query.place_price;
    const property_type = req.query.search_dropdown !== 'Property' ? req.query.search_dropdown : null; // Avoid "Property" as a filter

    // Logs input for debugging
    // console.log(`${place_location_address} ${place_price} ${property_type}`);

    // == Build the SQL Query Dynamically ==========

    // Base SQL query to fetch listings
    let sqlQuery = `
        SELECT 
            users.fullname AS host_name,
            host_listings.id AS property_id,
            host_listings.title AS property_title,
            host_listings.description AS property_description,
            host_listings.price_per_night AS property_price_per_night,
            host_listings.Images AS images,
            host_listings.available_from,
            host_listings.available_to,
            CASE strftime('%m', host_listings.available_from)
                WHEN '01' THEN 'January'
                WHEN '02' THEN 'February'
                WHEN '03' THEN 'March'
                WHEN '04' THEN 'April'
                WHEN '05' THEN 'May'
                WHEN '06' THEN 'June'
                WHEN '07' THEN 'July'
                WHEN '08' THEN 'August'
                WHEN '09' THEN 'September'
                WHEN '10' THEN 'October'
                WHEN '11' THEN 'November'
                WHEN '12' THEN 'December'
            END AS available_month,
            strftime('%d', host_listings.available_from) AS available_day,
            strftime('%Y', host_listings.available_from) AS available_year
        FROM users
        JOIN host_listings ON users.id = host_listings.user_id
        WHERE 1=1
    `;

    // Base SQL query to count total matching listings
    let countSql = `
        SELECT COUNT(*) AS total_places_found
        FROM users
        JOIN host_listings ON users.id = host_listings.user_id
        WHERE 1=1
    `;

    // Query parameters array to store dynamic conditions
    const queryParams = [];

    // Location filter (if provided)
    if (place_location_address) {
        sqlQuery += ` AND (
            host_listings.location LIKE ? 
            OR host_listings.county LIKE ? 
            OR host_listings.city LIKE ?
        )`;
        countSql += ` AND (
            host_listings.location LIKE ? 
            OR host_listings.county LIKE ? 
            OR host_listings.city LIKE ?
        )`;
        const locationSearchTerm = `%${place_location_address}%`;
        queryParams.push(locationSearchTerm, locationSearchTerm, locationSearchTerm);
    }

    // Price filter (if provided)
    if (place_price) {
        sqlQuery += ` AND host_listings.price_per_night <= ?`;
        countSql += ` AND host_listings.price_per_night <= ?`;
        queryParams.push(place_price);
    }

    // Property type filter (if provided)
    if (property_type) {
        sqlQuery += ` AND host_listings.property_type = ?`;
        countSql += ` AND host_listings.property_type = ?`;
        queryParams.push(property_type);
    }

    // Execute the SQL query for the listings
    lodge_liberia_db.all(sqlQuery, queryParams, (err, search_results1) => {
        if (err) {
            console.error('Error executing search query:', err);
            return res.status(500).send("Server Error");
        }

        // Execute the SQL query for the total count
        lodge_liberia_db.get(countSql, queryParams, (err, count_result) => {
            if (err) {
                console.error('Error executing count query:', err);
                return res.status(500).send("Server Error");
            }

            const total_places_found = count_result.total_places_found;

            // Process each result to convert images to Base64 format
            const search_results2 = search_results1.map(row => ({
                host_name: row.host_name,
                host_place_id: row.property_id,
                property_title: row.property_title,
                property_description: row.property_description,
                property_price_per_night: row.property_price_per_night,
                available_month: row.available_month,
                available_day: row.available_day,
                available_year: row.available_year,
                base64Image: row.images ? Buffer.from(row.images).toString('base64') : null
            }));

            // Render the results on the search result page
            res.render('search_result_page', {
                search_results2,
                total_places_found,
                user: req.session.user
            });
        });
    });
});


// Place/s detail route page
server.get('/place_detail/:host_place_id', (req, res) => {
    const selected_place = req.params.host_place_id; // Get the property ID from the URL

    const sqlQuery = `
        SELECT 
            users.fullname AS host_name,
            users.profile_picture AS host_picture,
            host_listings.title AS property_title,
            host_listings.description AS property_description,
            host_listings.detail_description AS property_detail_description,
            host_listings.price_per_night AS property_price_per_night,
            host_listings.min_stay_days AS minimum_host_days,
            host_listings.max_guest AS max_guest_count,
            host_listings.location AS property_location,
            host_listings.available_from,
            CASE strftime('%m', host_listings.available_from)
                WHEN '01' THEN 'January'
                WHEN '02' THEN 'February'
                WHEN '03' THEN 'March'
                WHEN '04' THEN 'April'
                WHEN '05' THEN 'May'
                WHEN '06' THEN 'June'
                WHEN '07' THEN 'July'
                WHEN '08' THEN 'August'
                WHEN '09' THEN 'September'
                WHEN '10' THEN 'October'
                WHEN '11' THEN 'November'
                WHEN '12' THEN 'December'
            END AS available_month,
            strftime('%d', host_listings.available_from) AS available_day,
            strftime('%Y', host_listings.available_from) AS available_year,
            host_images.image_data AS image_blob  -- Retrieve image BLOB data from the host_images table
        FROM users
        JOIN host_listings ON users.id = host_listings.user_id
        LEFT JOIN host_images ON host_listings.id = host_images.host_listing_id  -- Join with the images table
        WHERE host_listings.id = ?
    `;

    // First query to get the property details
    lodge_liberia_db.all(sqlQuery, [selected_place], (err, rows) => {
        if (err) {
            throw err;
        }
        if (rows.length > 0) {
            // Group the results by listing, since there could be multiple rows for the same listing (due to multiple images)
            const propertyDetails = {
                selected_place: selected_place,
                host_name: rows[0].host_name,
                host_picture: rows[0].host_picture ? Buffer.from(rows[0].host_picture).toString('base64') : null,
                property_title: rows[0].property_title,
                property_description: rows[0].property_description,
                property_detail_description: rows[0].property_detail_description,
                property_price_per_night: rows[0].property_price_per_night,
                property_location: rows[0].property_location,
                minimum_host_days: rows[0].minimum_host_days,
                max_guest_count: rows[0].max_guest_count,
                available_month: rows[0].available_month,
                available_day: rows[0].available_day,
                available_year: rows[0].available_year,
                images: rows.map(row => row.image_blob ? Buffer.from(row.image_blob).toString('base64') : null) // Convert each BLOB to Base64
            };

            // Second query to get features and their count from the host_places_features table
            const featuresQuery = `SELECT feature FROM host_places_features WHERE place_id = ?`;

            lodge_liberia_db.all(featuresQuery, [selected_place], (err, featureRows) => {
                if (err) {
                    throw err;
                }

                // Add features and count to the propertyDetails object
                propertyDetails.features = featureRows.map(row => row.feature);
                propertyDetails.feature_count = featureRows.length; // Count the features

                // Debugging
                console.log('Features:', propertyDetails.features);
                console.log('Feature Count:', propertyDetails.feature_count);

                // Render the detail page with the property data, the list of images (in Base64 format), and features
                res.render('place_detail', { place: propertyDetails, user: req.session.user });
            });
        } else {
            res.status(404).send("Place not found");
        }
    });
});

// Middleware to check if a user is logged in
function requireLogin(req, res, next) {
    if (!req.session.user) {
        // Store the original URL so the user can be redirected back after login
        req.session.returnTo = req.originalUrl;
        return res.redirect('/login');
    }
    next();
}

// Payment Route
server.get('/payment', requireLogin, async (req, res) => {

    const selected_place_id = req.query.selected_place_id; // Get the property ID from the URL
    const selected_place_title = req.query.selected_place_title; // Get the property title from the URL

    const selected_place_total_cost_over_period = req.query.grand_total; // Get the property total cost over period from the URL
    const roundedcost = Math.ceil(selected_place_total_cost_over_period);

    const checkin = req.query['start-date']; // Get the property checkin dates from the URL
    const checkout = req.query['end-date']; // Get the property checkout dates from the URL


    // SQL query to select the image blobs from the 'host_images' table where the 'host_listing_id' matches the listing ID
    const query = `SELECT image_data FROM host_images WHERE host_listing_id = ?`;

    // Implementing QR code payment

    // Orange Money QR Payment
    const orange_qr_payment = `*144*1*1*0770722633*${roundedcost}#`;
    // Mobile Money QR Payment
    const mobile_money_qr_payment = `*156*1*1*0881806488*2*${roundedcost}#`;

    // QR codes container (Objects)
    const qr_codes = {};

    // Function to generate QR code
    try {
        // Generate QR code for Orange Money
        qr_codes.orange_money = await QRCode.toDataURL(orange_qr_payment);

        // Generate QR code for Mobile Money
        qr_codes.mobile_money = await QRCode.toDataURL(mobile_money_qr_payment);
    }
    catch (err) {
        console.log(err);
        return res.status(500).send('Error generating QR codes');
    }

    // Execute the query, passing in the listing ID as a parameter
    lodge_liberia_db.all(query, [selected_place_id], (err, rows) => {
        if (err) {
            console.error("Database error:", err);  // Log any errors encountered during the database query
        }

        // Check if any rows (images) were returned from the query
        if (rows.length === 0) {
            return res.status(404).json({ message: "No images found for this listing." });  // Send a 404 response if no images are found
        }

        // Map through the rows and convert each image_blob to a Base64 string
        const images = rows.map(row => 
            row.image_data ? Buffer.from(row.image_data).toString('base64') : null  // Convert BLOB to Base64, or return null if no BLOB
        );

        res.render('lodgeliberia_payment', { user: req.session.user, place: images, selected_place_title, checkin, checkout, roundedcost, qr_codes });
    });
})


// Host Place Route
server.get('/hostplace', requireLogin, (req, res) => {
    // Store the original URL so the user can be redirected back after login
    req.session.returnTo = req.originalUrl;
    res.render('hosting', { user: req.session.user })
})

server.get('/userprofile', requireLogin, (req, res) => {
    res.render('user_profile', { user: req.session.user })
})



// Logout Route
server.get('/logout', (req, res) => {
    // Destroy the session
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.send('Error during logout');
        }
        // Clear the cookie as well, if necessary
        res.clearCookie('connect.sid');  // 'connect.sid' is the default session cookie name
        res.redirect('/');  // Redirect the user to the login page
    });
});


// Port Application is listening on {Port: 5600}
server.listen(port, () => {
    console.log(`Server running on port ${port}.`);
    console.log("Beautiful Tracy"); // Don't change this!!!
})
