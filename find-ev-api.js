document.addEventListener('DOMContentLoaded', () => {
    // --- Define all HTML elements at the top ---
    const resultsDiv = document.getElementById('results');
    const loadingDiv = document.getElementById('loading');
    const rangeSlider = document.getElementById('min-range');
    const priceSlider = document.getElementById('max-price');
    const safetySlider = document.getElementById('min-safety');
    const popularitySlider = document.getElementById('min-popularity');
    const chargeTimeSlider = document.getElementById('max-charge-time');
    const rangeValue = document.getElementById('range-value');
    const priceValue = document.getElementById('price-value');
    const safetyValue = document.getElementById('safety-value');
    const popularityValue = document.getElementById('popularity-value');
    const chargeTimeValue = document.getElementById('charge-time-value');
    
    let searchTimeout;

    // --- Function to perform the search ---
    const performSearch = async () => {
        resultsDiv.innerHTML = '';
        loadingDiv.classList.remove('hidden');

        const minRange = parseInt(rangeSlider.value);
        const maxPrice = parseInt(priceSlider.value);
        const minSafety = parseInt(safetySlider.value);
        const minPopularity = parseFloat(popularitySlider.value);
        const maxChargeTime = parseFloat(chargeTimeSlider.value);

        const params = new URLSearchParams({
            min_range: minRange,
            max_price: maxPrice,
            min_safety_rating: minSafety,
            min_popularity: minPopularity,
            max_charge_time: maxChargeTime
        });
        const apiUrl = `http://127.0.0.1:5000/search_cars?${params.toString()}`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch vehicle data.');
            }
            const vehicles = await response.json();

            if (vehicles.length === 0) {
                resultsDiv.innerHTML = '<p class="text-center col-span-full text-gray-400">No vehicles match your search criteria.</p>';
            } else {
                vehicles.forEach(vehicle => {
                    const vehicleCard = `
                        <div class="bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col justify-between transform hover:-translate-y-2 transition-transform duration-300">
                            <div>
                                <h2 class="text-2xl font-bold">${vehicle.Manufacturer} ${vehicle.Model}</h2>
                                <p class="text-sm text-gray-400 mb-4">${vehicle.Year} | ${vehicle.Color}</p>
                                <div class="grid grid-cols-2 gap-4 mb-4 text-sm">
                                    <p><strong>Range:</strong> ${vehicle.Range_km} km</p>
                                    <p><strong>Battery:</strong> ${vehicle.Battery_Capacity_kWh} kWh</p>
                                    <p><strong>Battery Type:</strong> ${vehicle.Battery_Type || 'N/A'}</p>
                                    <p><strong>Charge Time:</strong> ${vehicle.Charge_Time_hr} hours</p>
                                    <p><strong>Charging Type:</strong> ${vehicle.Charging_Type || 'N/A'}</p>
                                    <p><strong>Safety Rating:</strong> ${vehicle.Safety_Rating || 'N/A'} / 5</p>
                                    <p><strong>Popularity:</strong> ${vehicle.Popularity_Index || 'N/A'} / 5</p>
                                    <p><strong>Units Sold (2024):</strong> ${vehicle.Units_Sold_2024 ? vehicle.Units_Sold_2024.toLocaleString() : 'N/A'}</p>
                                    <p><strong>Warranty:</strong> ${vehicle.Warranty_Years || 'N/A'} years</p>
                                    <p><strong>Autonomous Level:</strong> ${vehicle.Autonomous_Level || 'N/A'}</p>
                                    <p><strong>Operating Temp:</strong> ${vehicle.Temp_Min}°C to ${vehicle.Temp_Max}°C</p>
                                    <p><strong>Made In:</strong> ${vehicle.Country_of_Manufacture || 'N/A'}</p>
                                </div>
                            </div>
                            <p class="text-green-400 text-3xl font-bold mt-4 text-right">
                                $${parseInt(vehicle.Price_USD).toLocaleString()}
                            </p>
                        </div>
                    `;
                    resultsDiv.innerHTML += vehicleCard;
                });
            }

        } catch (error) {
            console.error('Error:', error);
            resultsDiv.innerHTML = `<p class="text-red-400 text-center col-span-full">An error occurred: ${error.message}</p>`;
        } finally {
            loadingDiv.classList.add('hidden');
        }
    };

    // --- Event Listeners for sliders ---
    [rangeSlider, priceSlider, safetySlider, popularitySlider, chargeTimeSlider].forEach(slider => {
        slider.addEventListener('input', () => {
            // Update display values
            rangeValue.textContent = `${rangeSlider.value} km`;
            priceValue.textContent = `$${parseInt(priceSlider.value).toLocaleString()}`;
            safetyValue.textContent = `${safetySlider.value} / 5`;
            popularityValue.textContent = `${parseFloat(popularitySlider.value).toFixed(1)} / 5`;
            chargeTimeValue.textContent = `${parseFloat(chargeTimeSlider.value).toFixed(1)} hrs`;


            // Debounce search
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(performSearch, 300); // Wait 300ms before searching
        });
    });

    // --- Initial Search on page load ---
    performSearch();
});