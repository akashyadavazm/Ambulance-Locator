require('dotenv').config();
const express = require('express');
const app = express();
const axios = require('axios');

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.render('index', {
        results: null,
        latitude: null,
        longitude: null,
        error: null // Ensure 'error' is defined
    });
});

app.post('/search', async (req, res) => {
    const apiKey = process.env.GOOGLE_API_KEY;
    let { latitude, longitude, address, searchType, radius, placeType } = req.body;

    try {
        // If no coords provided, geocode the address
        if (!latitude || !longitude) {
            const queryAddress = address || 'Delhi';
            const geocodeURL = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(queryAddress)}&key=${apiKey}`;
            const geocodeRes = await axios.get(geocodeURL);
            console.log('Geocode response:', geocodeRes.data);

            if (geocodeRes.data.status !== 'OK' || geocodeRes.data.results.length === 0) {
                throw new Error('Geocoding failed');
            }

            const location = geocodeRes.data.results[0].geometry.location;
            latitude = location.lat;
            longitude = location.lng;
        }

        let placesURL;
        if (searchType === 'place') {
            // Search by place type
            placesURL = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=50000&type=${placeType || ''}&keyword=ambulance&key=${apiKey}`;
        } else {
            // Default search by radius
            placesURL = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius || 50000}&keyword=ambulance&key=${apiKey}`;
        }

        const placesRes = await axios.get(placesURL);
        if (placesRes.data.status !== 'OK') {
            throw new Error('Places search failed');
        }
        let results = [];
        if (placesRes.data.results && placesRes.data.results.length > 0) {
            results = await Promise.all(
                placesRes.data.results.map(async (place) => {
                    try {
                        const detailsURL = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,geometry&key=${apiKey}`;
                        const detailsRes = await axios.get(detailsURL);
                        const details = detailsRes.data.result;
                        console.log('Place: ', place);
                        console.log('Details: ', details);

                        return {
                            name: details.name,
                            address: details.formatted_address || place.vicinity,
                            phone: details.formatted_phone_number || 'Not available',
                            latitude: details.geometry.location.lat,
                            longitude: details.geometry.location.lng
                        };
                    } catch {
                        return {
                            name: place.name,
                            address: place.vicinity,
                            phone: 'Not available',
                            latitude: place.geometry.location.lat,
                            longitude: place.geometry.location.lng
                        };
                    }
                })
            );
        };

        res.render('index', {
            results,
            latitude,
            longitude,
            error: null
        });
    } catch (error) {
        console.error('Search error:', error);
        res.render('index', {
            results: [],
            latitude: null,
            longitude: null,
            error: 'Failed to load ambulance services for the given location.'
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));