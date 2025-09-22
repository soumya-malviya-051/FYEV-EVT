const emailForm = document.getElementById('email-form');
const otpForm = document.getElementById('otp-form');
const emailInput = document.getElementById('email');
const otpInput = document.getElementById('otp');
const errorMessage = document.getElementById('error-message');
const successMessage = document.getElementById('success-message');
const formTitle = document.getElementById('form-title');

emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    errorMessage.classList.add('hidden');
    successMessage.classList.add('hidden');

    try {
        const response = await fetch('http://127.0.0.1:5000/login/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Failed to send OTP.');
        }

        successMessage.textContent = data.message;
        successMessage.classList.remove('hidden');
        formTitle.textContent = 'Check Your Email';
        emailForm.classList.add('hidden');
        otpForm.classList.remove('hidden');
        emailInput.disabled = true;
        otpInput.focus();

    } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.remove('hidden');
    }
});

otpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const otp = otpInput.value;
    errorMessage.classList.add('hidden');

    try {
        const response = await fetch('http://127.0.0.1:5000/login/otp/verify', {
            method: 'POST',
            credentials: 'include', // Important: send cookies with the request
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp }),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Login failed.');
        }

        window.location.href = 'index.html';

    } catch (error) {
        errorMessage.textContent = error.message;
        errorMessage.classList.remove('hidden');
    }
});