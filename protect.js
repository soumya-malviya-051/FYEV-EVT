// protect.js

(async function () {
    try {
        const response = await fetch('http://127.0.0.1:5000/@me', {
            method: 'GET',
            credentials: 'include', // This is crucial for sending the session cookie
        });

        if (!response.ok) {
            // If the response is not OK (e.g., 401 Unauthorized), redirect
            window.location.href = 'login.html';
            return;
        }

        const data = await response.json();

        if (!data.user) {
            // If the response is OK but there's no user data, also redirect
            window.location.href = 'login.html';
        }
        // If we get here, the user is logged in and can stay on the page.
    } catch (error) {
        // If the server is down or there's a network error, redirect
        console.error('Authentication check failed, redirecting to login.', error);
        window.location.href = 'login.html';
    }
})();