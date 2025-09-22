// This script is ONLY for the find-ev.html page.

document.addEventListener('DOMContentLoaded', async () => {
    // ==============================================================================
    // NEW LOGIC TO FETCH USER DATA & HANDLE LOGOUT
    // ==============================================================================
    const userGreeting = document.getElementById("user-greeting");
    const logoutBtn = document.getElementById("logout-btn");
    const navLinks = document.getElementById("nav-links");

    // Fetch user data to display greeting
    try {
        const response = await fetch('http://127.0.0.1:5000/@me', {
            method: 'GET',
            credentials: 'include', // Crucial for sending the session cookie
        });
        if (response.ok) {
            const data = await response.json();
            if (data.user && userGreeting) {
                userGreeting.textContent = `Hi, ${data.user.name}`;
                navLinks.classList.remove('opacity-0'); // Make nav links visible
            }
        }
    } catch (error) {
        console.error("Could not fetch user data:", error);
    }
    
    // Add click event listener for the logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('http://127.0.0.1:5000/logout', {
                    method: 'POST',
                    credentials: 'include',
                });
                
                if (response.ok) {
                    // Redirect to the homepage after successful logout
                    window.location.href = 'index.html';
                } else {
                    alert('Logout failed. Please try again.');
                }
            } catch (error) {
                console.error("Logout request failed:", error);
                alert('An error occurred during logout.');
            }
        });
    }
    // ==============================================================================

    const suggestBtn = document.getElementById("suggestBtn");
    const userInput = document.getElementById("userInput");

    if (suggestBtn && userInput) {
        suggestBtn.addEventListener("click", handleSuggestion);
        userInput.addEventListener("keypress", (event) => {
            if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSuggestion();
            }
        });
    }
});

async function handleSuggestion() {
    const userInput = document.getElementById("userInput").value.trim();
    if (!userInput) {
        displayError("Please describe the EV you're looking for.");
        return;
    }

    setLoading(true);

    try {
        const response = await fetch("http://127.0.0.1:5000/suggest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_text: userInput }),
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `Server responded with status: ${response.status}`);
        }
        
        displayResult(data);

    } catch (error) {
        console.error("Fetch Error:", error);
        displayError(error.message);
    } finally {
        setLoading(false);
    }
}

function displayResult(data) {
    const resultDiv = document.getElementById("result");
    // MODIFIED: Removed image_url from this line
    const { name, tagline, specs, key_features, reasoning } = data;

    // MODIFIED: Removed image_url from the validation check
    if (!name || !tagline || !specs || !key_features || !reasoning) {
        displayError("The AI response did not contain a valid recommendation.");
        return;
    }

    document.getElementById("placeholder").classList.add("hidden");
    document.getElementById("error").classList.add("hidden");

    const specsHtml = Object.entries(specs)
        .map(([key, value]) => `
            <div class="flex justify-between border-b border-gray-700 py-2 text-sm">
                <span class="font-semibold text-gray-400">${key}</span>
                <span class="text-white">${value}</span>
            </div>`
        ).join("");

    const featuresHtml = key_features.length > 0 ? `
        <div class="mt-6">
            <h3 class="text-lg font-semibold text-white mb-3">Key Features</h3>
            <ul class="space-y-2 list-disc list-inside text-gray-300 text-sm">
                ${key_features.map(feature => `<li>${feature}</li>`).join("")}
            </ul>
        </div>` : "";

    resultDiv.innerHTML = `
        <div class="animate-fade-in">
            <h2 class="text-4xl font-bold text-white">${name}</h2>
            <p class="text-lg text-green-400 font-semibold mt-1">${tagline}</p>
            <div class="mt-6 grid grid-cols-2 gap-x-4 gap-y-2">${specsHtml}</div>
            ${featuresHtml}
            <div class="mt-8">
                 <h3 class="text-lg font-semibold text-white">Why This Is a Great Fit</h3>
                 <p class="mt-2 text-gray-400 text-sm leading-relaxed">${reasoning}</p>
            </div>
        </div>`;
}

function setLoading(isLoading) {
    const loadingDiv = document.getElementById("loading");
    const suggestBtn = document.getElementById("suggestBtn");
    const placeholderDiv = document.getElementById("placeholder");
    const resultDiv = document.getElementById("result");
    const errorDiv = document.getElementById("error");

    if (isLoading) {
        placeholderDiv.classList.add("hidden");
        errorDiv.classList.add("hidden");
        resultDiv.innerHTML = "";
        loadingDiv.classList.remove("hidden");
    } else {
        loadingDiv.classList.add("hidden");
    }

    suggestBtn.disabled = isLoading;
    suggestBtn.textContent = isLoading ? "ANALYZING..." : "Ask AI";
}

function displayError(message) {
    const errorDiv = document.getElementById("error");
    const placeholderDiv = document.getElementById("placeholder");
    const resultDiv = document.getElementById("result");

    resultDiv.innerHTML = "";
    placeholderDiv.classList.add("hidden");
    
    errorDiv.textContent = `Error: ${message}`;
    errorDiv.classList.remove("hidden");
}