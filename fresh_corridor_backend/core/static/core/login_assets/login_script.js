const container = document.getElementById('main-container');
const toSignup = document.getElementById('to-signup');
const toLogin = document.getElementById('to-login');
const themeToggler = document.querySelector('.theme-toggler');

// Toggle Switch Logic
if (toSignup) {
    toSignup.addEventListener('click', () => {
        container.classList.add('slide-up');
    });
}

if (toLogin) {
    toLogin.addEventListener('click', () => {
        container.classList.remove('slide-up');
    });
}

// Helper to get role from URL
function getCurrentRole() {
    const path = window.location.pathname;
    const roleSlug = path.split('/')[2]; // /login/planner/ -> planner
    const roleMap = {
        'planner': 'PLANNER',
        'farmer': 'AGRICULTURIST',
        'health': 'HEALTH',
        'resident': 'CITIZEN'
    };
    return roleMap[roleSlug] || 'CITIZEN';
}

// --- Generic Toast Notification ---
function showToast(message, type = 'info') {
    // Create element if not exists (or append new one)
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;

    let icon = 'info';
    if (type === 'success') icon = 'check_circle';
    if (type === 'error') icon = 'error_outline';

    toast.innerHTML = `
        <span class="material-icons-sharp" style="font-size: 1.5rem;">${icon}</span>
        <div>${message}</div>
    `;

    document.body.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Remove after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 3500);
}

// Login Logic
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const email = loginForm.querySelector('input[type="email"]').value;
        const password = loginForm.querySelector('input[type="password"]').value;

        // Visual feedback
        submitBtn.innerHTML = '<span class="material-icons-sharp" style="animation: spin 1s linear infinite; vertical-align: middle; margin-right: 8px;">sync</span> Authenticating...';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.7';

        try {
            const res = await fetch('/api/auth/login/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: email, password: password })
            });

            // Debug: Check if response is ok
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`Server Error (${res.status}): ${text.substring(0, 100)}...`);
            }

            const data = await res.json();

            if (data.user) { // Check for success through user object presence or similar
                // Success
                localStorage.setItem('user_role', data.role);
                localStorage.setItem('user_token', data.token || 'session'); // Dummy or real

                submitBtn.innerHTML = '<span class="material-icons-sharp" style="vertical-align: middle; margin-right: 8px;">check_circle</span> Sync Successful';
                submitBtn.style.background = '#10b981';

                setTimeout(() => {
                    window.location.href = '/'; // Go to Dashboard
                }, 800);
            } else {
                // Failure
                throw new Error(data.error || 'Login Failed');
            }
        } catch (err) {
            console.error(err);
            submitBtn.innerHTML = 'Login Failed';
            submitBtn.style.background = '#ef4444';
            setTimeout(() => {
                submitBtn.innerHTML = 'Login';
                submitBtn.style.background = '';
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                showToast(err.message, 'error');
            }, 2000);
        }
    });
}

// Signup Logic
const signupForm = document.getElementById('signup-form');
if (signupForm) {
    // --- Aadhar Validation (Verhoeff Algorithm) ---
    const d = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
        [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
        [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
        [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
        [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
        [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
        [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
        [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
        [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
    ];
    const p = [
        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
        [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
        [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
        [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
        [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
        [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
        [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
    ];

    function validateAadhar(aadharNumber) {
        if (!aadharNumber || aadharNumber.length !== 12) return false;
        let c = 0;
        let invertedArray = aadharNumber.split('').map(Number).reverse();
        invertedArray.forEach((val, i) => {
            c = d[c][p[(i % 8)][val]];
        });
        return (c === 0);
    }

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputs = signupForm.querySelectorAll('input');
        const role = getCurrentRole();

        // Extract inputs (Assumption: Order is Name, Email, Password, Aadhar)
        // We will add logic to find Aadhar by ID or generic fallback
        let name = inputs[0].value;
        let email = inputs[1].value;
        let password = inputs[2].value;
        let aadhar = '';

        // Look for specific aadhar input if exists, else assume it might be last
        const aadharInput = document.getElementById('aadhar-input');
        if (aadharInput) {
            aadhar = aadharInput.value;
            if (!validateAadhar(aadhar)) {
                showToast("Invalid Aadhar Number. Please check and try again.", 'error');
                return;
            }
        }

        const submitBtn = signupForm.querySelector('button');
        const originalText = submitBtn.innerText;
        submitBtn.innerText = 'Verifying Identity...';
        submitBtn.disabled = true; // Added this line to disable button during verification

        try {
            const res = await fetch('/api/auth/signup/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: name,
                    email: email,
                    password: password,
                    role: role.toUpperCase(),
                    aadhar_number: aadhar
                })
            });
            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('user_role', data.role);
                localStorage.setItem('user_token', 'session');

                submitBtn.innerHTML = 'Identity Established';
                setTimeout(() => {
                    window.location.href = '/';
                }, 1000);
            } else {
                // Failure
                // Check if error is object (validation errors)
                let errorMsg = 'Signup Failed';
                if (typeof data === 'object') {
                    errorMsg = Object.values(data).flat().join('\n');
                }
                throw new Error(errorMsg);
            }
        } catch (err) {
            console.error(err);
            submitBtn.innerHTML = 'Failed';
            submitBtn.style.background = '#ef4444';
            setTimeout(() => {
                submitBtn.innerHTML = 'Establish Access';
                submitBtn.style.background = '';
                submitBtn.disabled = false;
                showToast(err.message, 'error');
            }, 2000);
        }
    });
}

// Unified Theme Toggler
if (themeToggler) {
    themeToggler.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme-variables');
        themeToggler.querySelectorAll('span').forEach(span => span.classList.toggle('active'));

        const isDark = document.body.classList.contains('dark-theme-variables');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
}

// Initial Theme Check
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme-variables');
    if (themeToggler) {
        themeToggler.querySelector('span:nth-child(1)').classList.remove('active');
        themeToggler.querySelector('span:nth-child(2)').classList.add('active');
    }
}

// Add global spin animation for the sync icon
const spinStyle = document.createElement('style');
spinStyle.innerHTML = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(spinStyle);
