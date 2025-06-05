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
        // Geocode if no coordinates provided
        if (!latitude || !longitude) {
            const queryAddress = address || 'Delhi';
            const geocodeURL = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(queryAddress)}&key=${apiKey}`;
            const geocodeRes = await axios.get(geocodeURL);
            if (geocodeRes.data.status !== 'OK' || geocodeRes.data.results.length === 0) {
                throw new Error('Geocoding failed');
            }
            const location = geocodeRes.data.results[0].geometry.location;
            latitude = location.lat;
            longitude = location.lng;
        }

        // Build base URL
        const baseURL = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius || 10000}&keyword=ambulance${searchType === 'place' && placeType ? `&type=${placeType}` : ''}&key=${apiKey}`;

        let allPlaces = [];
        let nextPageToken = null;
        let pageCount = 0;

        // Fetch up to 3 pages
        do {
            const url = nextPageToken
                ? `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${nextPageToken}&key=${apiKey}`
                : baseURL;

            if (nextPageToken) {
                await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2 sec
            }

            const response = await axios.get(url);
            if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
                throw new Error('Places search failed');
            }

            allPlaces.push(...(response.data.results || []));
            nextPageToken = response.data.next_page_token || null;
            pageCount++;
        } while (nextPageToken && pageCount < 3);

        // Fetch detailed info
        const results = await Promise.all(
            allPlaces.map(async (place) => {
                try {
                    const detailsURL = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,geometry&key=${apiKey}`;
                    const detailsRes = await axios.get(detailsURL);
                    const details = detailsRes.data.result;

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