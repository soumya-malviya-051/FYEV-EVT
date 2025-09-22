document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const errorMessage = document.getElementById('error-message');
    
    errorMessage.classList.add('hidden');

    if (!name || !email) {
        errorMessage.textContent = 'Please fill out both name and email fields.';
        errorMessage.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch('http://127.0.0.1:5000/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email }), // Send name and email
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Registration failed due to an unknown error.');
        }

        alert('Registration successful! Please proceed to the login page.');
        window.location.href = 'login.html';

    } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.remove('hidden');
    }
});