// auth.js

document.addEventListener('DOMContentLoaded', async () => {
    const navLinksContainer = document.getElementById('nav-links');
    if (!navLinksContainer) return;

    // --- THIS IS THE FIX ---
    // Make the navigation bar visible on all pages
    navLinksContainer.classList.remove('opacity-0');
    // ----------------------

    const commonLinks = `
    <a href="index.html" class="hover:text-green-500 transition-colors">Home</a>
    <a href="find-ev.html" class="hover:text-green-500 transition-colors">AI Advisor</a>
    <a href="find-ev-api.html" class="hover:text-green-500 transition-colors">EV Search</a>
    <a href="stations.html" class="hover:text-green-500 transition-colors">Charging Stations</a>
    `;

    try {
        const response = await fetch('http://127.0.0.1:5000/@me', {
            method: 'GET',
            credentials: 'include',
        });

        const data = await response.json();

        if (response.ok && data.user) {
            // User is logged in
            navLinksContainer.innerHTML = `
                ${commonLinks}
                <span class="text-gray-400">Hi, ${data.user.name}</span>
                <button id="logout-btn" class="bg-red-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-red-600 transition">Logout</button>
            `;
            document.getElementById('logout-btn').addEventListener('click', async () => {
                await fetch('http://127.0.0.1:5000/logout', { credentials: 'include', method: 'POST' });
                window.location.href = 'login.html';
            });
        } else {
            // User is not logged in
            navLinksContainer.innerHTML = `
                ${commonLinks}
                <a href="login.html" class="font-semibold text-gray-300 hover:text-white transition-colors">Login</a>
                <a href="register.html" class="bg-green-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-green-600 transition">Register</a>
            `;
        }
    } catch (error) {
        console.error("Auth check failed:", error);
        // Fallback for when the API is down
        navLinksContainer.innerHTML = `
            ${commonLinks}
            <a href="login.html" class="font-semibold text-gray-300 hover:text-white transition-colors">Login</a>
            <a href="register.html" class="bg-green-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-green-600 transition">Register</a>
        `;
    }
});