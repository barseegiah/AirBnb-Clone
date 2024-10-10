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

// Multer Library Configuration
// Setup storage for storing files in memory
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
                phone_number TEXT,
                email TEXT UNIQUE,
                username TEXT NOT NULL,
                password TEXT NOT NULL,
                profile_pic BLOB,
                image_mime_type TEXT,
                occupation TEXT,
                education TEXT,
                age INTEGER,
                user_agreement BOOLEAN DEFAULT 0,
                time_created DATETIME DEFAULT CURRENT_TIMESTAMP,
                national_identification_card_verification BLOB
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
                image_mime_type TEXT,
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
                image_mime_type TEXT,
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
            )`,
            `CREATE TABLE IF NOT EXISTS Payment_confirmation (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                guest_name TEXT NOT NULL,
                guest_phone_number BLOB NOT NULL,
                payment_approval_image BLOB NOT NULL,
                image_mime_type TEXT NOT NULL,
                place_id INTEGER NOT NULL,
                amount_paid REAL NOT NULL,
                checkin DATE,
                checkout DATE,
                FOREIGN KEY (user_id) REFERENCES users(id)
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


// Signup form post route
server.post('/signup', upload.single('profilePic'), (req, res) => {
    const { fullname, phone_number, email, username, password, occupation, education, age, useragreement } = req.body;

    // Check if the user uploaded a profile picture
    const profilePic = req.file ? req.file.buffer : null;

    // Get the mime type of the cover image
    const profilePicMimeType = req.file ? req.file.mimetype : null;

    // Insert the new user data into the 'users' table
    const sql = `
    INSERT INTO users (role, fullname, phone_number, email, username, password, profile_picture, image_mime_type, occupation, education, age, user_agreement)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Run the SQL query
    lodge_liberia_db.run(sql, [
        "guest", // role
        fullname,
        phone_number,
        email,
        username,
        password,
        profilePic, // Profile picture stored as binary
        profilePicMimeType, // Profile picture mime_type
        occupation,
        education,
        age,
        useragreement === 'user agreement approval' ? 1 : 0 // Convert checkbox to boolean
    ], function (err) {
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

// Confirmation post route
server.post('/confirmation', upload.single('sender_approval_image'), (req, res) => {

    // Function to format the date as "Month Day, Year"
    function formatDateToReadable(dateStr) {
        const date = new Date(dateStr); // Convert string to Date object
        const options = { year: 'numeric', month: 'long', day: 'numeric' }; // Define options for formatting
        return new Intl.DateTimeFormat('en-US', options).format(date); // Format the date
    }

    const user_confirmation_data = {
        sender_approval_img: req.file ? req.file.buffer : null,
        image_mime_type: req.file ? req.file.mimetype : null, // Capture the image MIME type
        sender_name: req.body.sender_name,
        sender_phone_number: req.body.sender_registered_number,
        checkin_date: formatDateToReadable(req.body.checkin_date),
        checkout_date: formatDateToReadable(req.body.checkout_date),
        selected_place_id: req.body.place_id,
        selected_place_title: req.body.place_title,
        amount_total: req.body.amount_total
    }

    // Access the session user
    const sessionUser = req.session.user;

    // SQL query to insert the data
    const sql = `INSERT INTO Payment_confirmation (user_id, guest_name, guest_phone_number, payment_approval_image, image_mime_type, place_id, amount_paid, checkin, checkout)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    // Obtaining User ID from the session and provide the necessary data
    const params = [
        sessionUser.id, // User ID
        user_confirmation_data.sender_name, // Sender Name
        user_confirmation_data.sender_phone_number, // Sender transaction phone number
        user_confirmation_data.sender_approval_img,  // Approval Image
        user_confirmation_data.image_mime_type, // Store the MIME type
        user_confirmation_data.selected_place_id, // place_id
        user_confirmation_data.amount_total, // amount_paid
        user_confirmation_data.checkin_date,
        user_confirmation_data.checkout_date
    ];

    // SQL query to select the image blobs from the 'host_images' table where the 'host_listing_id' matches the listing ID
    const images_query = `SELECT image_data FROM host_images WHERE host_listing_id = ?`;

    // SQL query to select the place location
    const place_location_query = `SELECT location FROM host_listings WHERE id = ?`;

    // Now retrieve the inserted payment confirmation image with the MIME type
    const retrieveImageSql = `SELECT payment_approval_image, image_mime_type FROM Payment_confirmation WHERE id = ?`;

    lodge_liberia_db.run(sql, params, function (err) {
        if (err) {
            console.error(err.message); // error if any
            return res.status(500).send('Error inserting data into the database'); // Send error response
        }

        // Payment Confirmation ID
        const confirmationId = this.lastID;

        // Execute the query, passing in the listing ID as a parameter
        lodge_liberia_db.all(images_query, [user_confirmation_data.selected_place_id], (err, rows) => {
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

            // Execute another query, getting place location
            lodge_liberia_db.all(place_location_query, [user_confirmation_data.selected_place_id], (err, rows) => {
                if (err) {
                    console.error("Database error:", err);  // Log any errors encountered during the database query
                }
                const place_location = rows[0].location;

                // Query to retrieve payment confirmation image
                lodge_liberia_db.get(retrieveImageSql, [confirmationId], (err, row) => {
                    if (err) {
                        return console.error(err.message);
                    }
                    if (row && row.payment_approval_image) {
                        // Convert BLOB to base64 for display on the client side
                        const imageBase64 = row.payment_approval_image.toString('base64');

                        // Successful insertion
                        console.log(`A row has been inserted with rowid ${this.lastID}`);
                        res.render('payment_confirmation', {
                            user: req.session.user, place: images, checkin: user_confirmation_data.checkin_date,
                            checkout: user_confirmation_data.checkout_date, roundedcost: user_confirmation_data.amount_total,
                            selected_place_title: user_confirmation_data.selected_place_title, account_owner_name: sessionUser.fullname,
                            sender_name: user_confirmation_data.sender_name,
                            registered_phone_number: user_confirmation_data.sender_phone_number,
                            place_location: place_location, payment_image: imageBase64, image_mime_type: row.image_mime_type // Pass the MIME type to the template
                        });

                    }

                });
            });

        });

    });
});

// Host Place Post Route
server.post('/submit_property', upload.fields([{ name: 'host_cover_image' }, { name: 'hosting_images[]' }]), (req, res) => {
    // Log the form data to check if everything is received
    // console.log('Form Data:', req.body);

    // // Check if the cover image and additional images are received
    // console.log('Cover Image:', req.files['host_cover_image']);
    // console.log('Additional Images:', req.files['hosting_images[]']);

    const amenities = req.body['allAmenities[][]'];

    // Log the amenities received from the form
    console.log('Amenities:', amenities);

    const {
        propertyName,
        propertyType,
        address,
        city,
        county,
        startDate,
        minStayDays,
        maxGuests,
        price,
        briefDescriptionValue,
        detailDescriptionValue,
    } = req.body;

    const host_cover_image = req.files['host_cover_image'][0]; // Cover image
    const additional_images = req.files['hosting_images[]']; // Additional images

    // Step 1: Insert data into `host_listings` table
    const insertHostListingQuery = `
        INSERT INTO host_listings 
        (user_id, title, description, detail_description, location, price_per_night, max_guest, available_from, county, city, property_type, min_stay_days, max_guest, IMAGES, image_mime_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Access the session user
    const sessionUser = req.session.user; //logged-in user and their ID is available in `req.user.id`
    const location = `${address}`; // Combine address details
    const pricePerNight = parseFloat(price);
    const availableFrom = startDate;
    const maxGuestsParsed = parseInt(maxGuests);
    const minStayDaysParsed = parseInt(minStayDays);

    // Get the mime type of the cover image
    const coverImageMimeType = host_cover_image.mimetype;

    lodge_liberia_db.run(insertHostListingQuery, [
        sessionUser.id,
        propertyName,
        briefDescriptionValue,
        detailDescriptionValue,
        location,
        pricePerNight,
        maxGuestsParsed,
        availableFrom,
        county,
        city,
        propertyType,
        minStayDaysParsed,
        maxGuestsParsed,
        host_cover_image.buffer, // Cover image as binary data
        coverImageMimeType // Mime type of the cover image
    ], function (err) {
        if (err) {
            console.error('Error inserting into host_listings:', err);
            return res.status(500).send('An error occurred while saving the listing.');
        }

        const hostListingId = this.lastID; // Get the inserted row's ID

        // Step 2: Insert additional images into `host_images` table
        const insertImageQuery = `
            INSERT INTO host_images (host_listing_id, image_data, image_mime_type) 
            VALUES (?, ?, ?)
        `;

        additional_images.forEach(image => {
            const imageMimeType = image.mimetype; // Get mime type of the additional images
            lodge_liberia_db.run(insertImageQuery, [hostListingId, image.buffer, imageMimeType], function (err) {
                if (err) {
                    console.error('Error inserting into host_images:', err);
                }
            });
        });

        // Step 3: Insert amenities into `host_places_features` table
        const insertFeatureQuery = `
            INSERT INTO host_places_features (place_id, feature, feature_type, feature_description) 
            VALUES (?, ?, ?, ?)
        `;

        // Insert amenities using propertyType as feature_type
        amenities.forEach(amenity => {
            // Assuming amenities are passed as an array of strings
            lodge_liberia_db.run(insertFeatureQuery, [hostListingId, amenity, propertyType, null], function (err) {
                if (err) {
                    console.error('Error inserting into host_places_features:', err);
                }
            });
        });

        // After everything is done, respond with success or redirect
        console.log("Everthing Enter Successfully.");
        res.render('hosting', {user: req.session.user});
    });
});



// Post Methods ********


// ==== Get methods

// Login Page Route
server.get("/login", (req, res) => {
    res.render('login_signup', { errorMessage: null }); // Pass errorMessage as null or '' initially
});


// About Page Route
server.get("/about", (req, res) => {
    res.render('about', { user: req.session.user });
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
                host_listings.image_mime_type AS image_mime_type,
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
                host_listings.image_mime_type AS image_mime_type,
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
                host_listings.image_mime_type AS image_mime_type,
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
                host_listings.image_mime_type AS image_mime_type,
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
                host_listings.image_mime_type AS image_mime_type,
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
                host_listings.image_mime_type AS image_mime_type,
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
            image_mime_type: row.image_mime_type,
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
                image_mime_type: row.image_mime_type,
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
                    image_mime_type: row.image_mime_type,
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
                        image_mime_type: row.image_mime_type,
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
                            image_mime_type: row.image_mime_type,
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
                                image_mime_type: row.image_mime_type,
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
            users.id AS host_id,
            users.fullname AS host_name,
            users.profile_picture AS host_picture,
            users.image_mime_type AS host_image_mime_type,
            users.occupation AS user_occupation,
            users.education AS user_education,
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
            host_images.image_mime_type AS image_mime_type, -- retrieve image mimie type
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
                host_id: rows[0].host_id,
                host_name: rows[0].host_name,
                host_picture: rows[0].host_picture ? Buffer.from(rows[0].host_picture).toString('base64') : null,
                host_image_mime_type: rows[0].host_image_mime_type,
                host_occupation: rows[0].user_occupation,
                host_education: rows[0].user_education,
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
                image_mime_type: rows[0].image_mime_type,
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
    const selected_place_total_cost_over_period2 = req.query.grand_total2; // Get the property total cost over period from the URL
    const roundedcost = Math.ceil(selected_place_total_cost_over_period);
    const roundedcost2 = Math.ceil(selected_place_total_cost_over_period2);

    // Function to format the date as "Month Day, Year"
    function formatDateToReadable(dateStr) {
        const date = new Date(dateStr); // Convert string to Date object
        const options = { year: 'numeric', month: 'long', day: 'numeric' }; // Define options for formatting
        return new Intl.DateTimeFormat('en-US', options).format(date); // Format the date
    }

    // Determine which variable to send to the template
    let displayValue;
    if (roundedcost) {
        displayValue = roundedcost; // If roundedcost exists, use it
    } else if (roundedcost2) {
        displayValue = roundedcost2; // Otherwise, use roundedcost2
    } else {
        displayValue = 'No data available'; // Default message if both are null
    }

    const checkin = formatDateToReadable(req.query['start-date']); // Get the property checkin dates from the URL
    const checkout = formatDateToReadable(req.query['end-date']); // Get the property checkout dates from the URL


    // SQL query to select the image blobs from the 'host_images' table where the 'host_listing_id' matches the listing ID
    const query = `SELECT image_data FROM host_images WHERE host_listing_id = ?`;

    // Implementing QR code payment

    // Orange Money QR Payment
    const orange_qr_payment = `*144*1*1*0770722633*${displayValue}#`;
    // Mobile Money QR Payment
    const mobile_money_qr_payment = `*156*1*1*0881806488*2*${displayValue}#`;

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

        res.render('lodgeliberia_payment', { user: req.session.user, place: images, selected_place_title, checkin, checkout, roundedcost, roundedcost2, qr_codes, selected_place_id });
    });
})


// Host Place Route
server.get('/hostplace', requireLogin, (req, res) => {

    // Store the original URL so the user can be redirected back after login
    req.session.returnTo = req.originalUrl;

    // Access the session user
    const sessionUser = req.session.user; //logged-in user and their ID is available in `req.user.id`

    // User places hosted
    const user_places_hosted = `
                 SELECT 
                users.fullname AS host_name,
                host_listings.title AS property_title,
                host_listings.id AS property_id,
                host_listings.description AS property_description,
                host_listings.price_per_night AS property_price_per_night,
                host_listings.Images AS images,
                host_listings.image_mime_type AS image_mime_type,
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
            WHERE users.id = ${sessionUser.id}
            `;


    // Query the database for amenities
    const query = `SELECT feature FROM places_features`; // Adjust the table/column names to match your DB
    lodge_liberia_db.all(query, [], (err, amenities) => {
        if (err) {
            console.error('Error fetching amenities:', err);
            return res.status(500).send('Error fetching amenities');
        }

        // Fifth query to get only Rooms
        lodge_liberia_db.all(user_places_hosted, [], (err, rooms_Rows) => {
            if (err) throw err;

            // Process Rooms rows and store in results object
            const host_property = rooms_Rows.map(row => ({
                host_name: row.host_name,
                host_place_id: row.property_id,
                property_title: row.property_title,
                property_description: row.property_description,
                property_price_per_night: row.property_price_per_night,
                available_month: row.available_month,
                available_day: row.available_day,
                available_year: row.available_year,
                image_mime_type: row.image_mime_type,
                // Convert BLOB image data to Base64 (if available)
                base64Image: row.images ? Buffer.from(row.images).toString('base64') : null
            }));

            // Render the hosting view and pass the user and amenities
            res.render('hosting', {
                user: req.session.user,
                place: host_property,
                amenities: amenities // Pass the amenities to the template
            });

        })

    });
});


// User Profile Route
server.get('/my_profile', requireLogin, (req, res) => {

    // Access the session user
    const sessionUser = req.session.user;

    const get_host_info_query = `
        SELECT
        users.fullname AS host_fullname,
        users.education AS host_education,
        users.occupation AS host_occupation,
        users.phone_number AS host_phone_number,
        users.email AS host_email,
        users.profile_picture AS host_picture,
        users.image_mime_type AS host_picture_mime_type,
        users.age AS host_age
        FROM users
        WHERE users.id = ?
    `;

    lodge_liberia_db.all(get_host_info_query, [sessionUser.id], (err, host_info) => {
        if (err) throw err;

        // Process the host information and map it to the result object
        const host_detail = host_info.map(row => ({
            host_name: row.host_fullname,
            host_education: row.host_education,
            host_occupation: row.host_occupation,
            host_phone_number: row.host_phone_number,
            host_email: row.host_email,
            host_picture: row.host_picture ? Buffer.from(row.host_picture).toString('base64') : null,
            host_picture_mime_type: row.host_picture_mime_type,
            host_age: row.host_age,
        }));

        console.log(host_detail);

        res.render('my_profile', { user: req.session.user, place: host_detail });

    });

});

// Host Profile Route
server.get('/host_profile/:host_id', requireLogin, (req, res) => {

    // About Host
    const selected_host_id = req.params.host_id;
    // console.log(selected_host);

    const get_host_info_query = `
        SELECT
        users.fullname AS host_fullname,
        users.education AS host_education,
        users.occupation AS host_occupation,
        users.phone_number AS host_phone_number,
        users.email AS host_email,
        users.profile_picture AS host_picture,
        users.image_mime_type AS host_picture_mime_type,
        users.age AS host_age
        FROM users
        WHERE users.id = ?
    `;

    lodge_liberia_db.all(get_host_info_query, [selected_host_id], (err, host_info) => {
        if (err) throw err;

        // Process the host information and map it to the result object
        const host_detail = host_info.map(row => ({
            host_name: row.host_fullname,
            host_education: row.host_education,
            host_occupation: row.host_occupation,
            host_phone_number: row.host_phone_number,
            host_email: row.host_email,
            host_picture: row.host_picture ? Buffer.from(row.host_picture).toString('base64') : null,
            host_picture_mime_type: row.host_picture_mime_type,
            host_age: row.host_age,
        }));

        res.render('host_profile', { user: req.session.user, place: host_detail });

    });

});

// My booking (Places booked by a user route configuration)
server.get('/my_booking', requireLogin, (req, res) => {

    // Access the session user
    const sessionUser = req.session.user; //logged-in user and their ID is available in `req.user.id`

    // User places hosted
    const user_places_booked = `
        SELECT

        users.fullname AS hostname,
        
        -- Booking details
        payment_confirmation.amount_paid AS total_amount_paid,
        payment_confirmation.checkin AS checkin_date,
        payment_confirmation.checkout AS checkout_date,

        -- Property details
        host_listings.title AS property_title,
        host_listings.description AS property_description,
        host_listings.Images AS images,
        host_listings.image_mime_type AS image_mime_type

    FROM 
        payment_confirmation
    JOIN 
        host_listings ON payment_confirmation.place_id = host_listings.id
    LEFT JOIN 
        users ON host_listings.user_id = users.id  -- Join with the host (not the booking user)
    WHERE 
        payment_confirmation.user_id = ${sessionUser.id};  -- Filter by the booking user, not the host
            `;

    // Fifth query to get only Rooms
    lodge_liberia_db.all(user_places_booked, [], (err, rooms_Rows) => {
        if (err) throw err;

        // Process Rooms rows and store in results object
        host_property = rooms_Rows.map(row => ({
            host_name: row.hostname,
            property_title: row.property_title,
            property_description: row.property_description,
            checkin_date: row.checkin_date,
            checkout_date: row.checkout_date,
            total_paid: row.total_amount_paid,
            image_mime_type: row.image_mime_type,
            // Convert BLOB image data to Base64 (if available)
            base64Image: row.images ? Buffer.from(row.images).toString('base64') : null
        }));

        console.log(host_property)
            ;
        res.render('my_booking', { user: req.session.user, place: host_property });
    });

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
