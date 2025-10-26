class Auth {
    constructor() {
        // Initialize forms
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');
        
        // Login form elements
        this.loginEmail = document.getElementById('loginEmail');
        this.loginPassword = document.getElementById('loginPassword');
        this.loginEmailError = document.getElementById('loginEmailError');
        this.loginPasswordError = document.getElementById('loginPasswordError');
        this.loginTogglePassword = document.getElementById('loginTogglePassword');
        this.rememberCheckbox = document.getElementById('remember');

        // Register form elements
        this.firstName = document.getElementById('firstName');
        this.lastName = document.getElementById('lastName');
        this.registerEmail = document.getElementById('registerEmail');
        this.registerPassword = document.getElementById('registerPassword');
        this.confirmPassword = document.getElementById('confirmPassword');
        this.firstNameError = document.getElementById('firstNameError');
        this.lastNameError = document.getElementById('lastNameError');
        this.registerEmailError = document.getElementById('registerEmailError');
        this.registerPasswordError = document.getElementById('registerPasswordError');
        this.confirmPasswordError = document.getElementById('confirmPasswordError');
        this.registerTogglePassword = document.getElementById('registerTogglePassword');
        this.confirmTogglePassword = document.getElementById('confirmTogglePassword');

        this.init();
    }

    init() {
        // Form submissions
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));

        // Password toggles
        this.loginTogglePassword.addEventListener('click', () => 
            this.togglePasswordVisibility(this.loginPassword, this.loginTogglePassword));
        this.registerTogglePassword.addEventListener('click', () => 
            this.togglePasswordVisibility(this.registerPassword, this.registerTogglePassword));
        this.confirmTogglePassword.addEventListener('click', () => 
            this.togglePasswordVisibility(this.confirmPassword, this.confirmTogglePassword));

        // Real-time validation
        this.loginEmail.addEventListener('input', () => this.validateEmail(this.loginEmail, this.loginEmailError));
        this.loginPassword.addEventListener('input', () => this.validatePassword(this.loginPassword, this.loginPasswordError));

        this.firstName.addEventListener('input', () => this.validateName(this.firstName, this.firstNameError, 'First name'));
        this.lastName.addEventListener('input', () => this.validateName(this.lastName, this.lastNameError, 'Last name'));
        this.registerEmail.addEventListener('input', () => this.validateEmail(this.registerEmail, this.registerEmailError));
        this.registerPassword.addEventListener('input', () => this.validatePassword(this.registerPassword, this.registerPasswordError));
        this.confirmPassword.addEventListener('input', () => this.validateConfirmPassword());

        // Check for existing session
        this.checkSession();
    }

    handleLogin(e) {
        e.preventDefault();
        console.log('Login attempt...');

        if (!this.validateLoginForm()) return;

        this.setLoadingState(this.loginForm, true);

        // Call backend login slot via QWebChannel
        if (window.backend && window.backend.login) {
            window.backend.login(this.loginEmail.value, this.loginPassword.value, (response) => {
                this.setLoadingState(this.loginForm, false);
                if (response.success) {
                    localStorage.setItem('user', JSON.stringify(response.user));
                    localStorage.setItem('authToken', response.token);
                    // Notify backend of login success
                    if (window.backend.notifyLoginSuccess) {
                        window.backend.notifyLoginSuccess();
                    }
                } else {
                    this.showError(this.loginPasswordError, response.message || 'Login failed');
                }
            });
        } else {
            this.showError(this.loginPasswordError, 'Backend not available');
            this.setLoadingState(this.loginForm, false);
        }
    }

    handleRegister(e) {
        e.preventDefault();
        console.log('Registration attempt...');

        if (!this.validateRegisterForm()) return;

        this.setLoadingState(this.registerForm, true);

        // Prepare registration data
        const registrationData = JSON.stringify({
            firstName: this.firstName.value,
            lastName: this.lastName.value,
            email: this.registerEmail.value,
            password: this.registerPassword.value,
            confirmPassword: this.confirmPassword.value
        });

        // Call backend register slot via QWebChannel
        if (window.backend && window.backend.register) {
            window.backend.register(registrationData, (response) => {
                this.setLoadingState(this.registerForm, false);
                if (response.success) {
                    localStorage.setItem('user', JSON.stringify(response.user));
                    localStorage.setItem('authToken', response.token);
                    // Notify backend of login success
                    if (window.backend.notifyLoginSuccess) {
                        window.backend.notifyLoginSuccess();
                    }
                } else {
                    this.showError(this.registerEmailError, response.message || 'Registration failed');
                }
            });
        } else {
            this.showError(this.registerEmailError, 'Backend not available');
            this.setLoadingState(this.registerForm, false);
        }
    }

    validateLoginForm() {
        let isValid = true;

        if (!this.validateEmail(this.loginEmail, this.loginEmailError)) isValid = false;
        if (!this.validatePassword(this.loginPassword, this.loginPasswordError)) isValid = false;

        return isValid;
    }

    validateRegisterForm() {
        let isValid = true;

        if (!this.validateName(this.firstName, this.firstNameError, 'First name')) isValid = false;
        if (!this.validateName(this.lastName, this.lastNameError, 'Last name')) isValid = false;
        if (!this.validateEmail(this.registerEmail, this.registerEmailError)) isValid = false;
        if (!this.validatePassword(this.registerPassword, this.registerPasswordError)) isValid = false;
        if (!this.validateConfirmPassword()) isValid = false;

        return isValid;
    }

    validateName(input, errorElement, fieldName) {
        const value = input.value.trim();
        
        if (!value) {
            this.showError(errorElement, `${fieldName} is required`);
            return false;
        }

        if (value.length < 2) {
            this.showError(errorElement, `${fieldName} must be at least 2 characters`);
            return false;
        }

        if (!/^[a-zA-Z\s]+$/.test(value)) {
            this.showError(errorElement, `${fieldName} can only contain letters`);
            return false;
        }

        this.hideError(errorElement);
        return true;
    }

    validateEmail(input, errorElement) {
        const email = input.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email) {
            this.showError(errorElement, 'Email is required');
            return false;
        }

        if (!emailRegex.test(email)) {
            this.showError(errorElement, 'Please enter a valid email');
            return false;
        }

        this.hideError(errorElement);
        return true;
    }

    validatePassword(input, errorElement) {
        const password = input.value;

        if (!password) {
            this.showError(errorElement, 'Password is required');
            return false;
        }

        if (password.length < 8) {
            this.showError(errorElement, 'Password must be at least 8 characters');
            return false;
        }

        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            this.showError(errorElement, 'Password must contain uppercase, lowercase and numbers');
            return false;
        }

        this.hideError(errorElement);
        return true;
    }

    validateConfirmPassword() {
        if (!this.confirmPassword.value) {
            this.showError(this.confirmPasswordError, 'Please confirm your password');
            return false;
        }

        if (this.confirmPassword.value !== this.registerPassword.value) {
            this.showError(this.confirmPasswordError, 'Passwords do not match');
            return false;
        }

        this.hideError(this.confirmPasswordError);
        return true;
    }

    togglePasswordVisibility(input, icon) {
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        icon.classList.toggle('bi-eye');
        icon.classList.toggle('bi-eye-slash');
    }

    showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
        element.parentElement.classList.add('shake');
        setTimeout(() => {
            element.parentElement.classList.remove('shake');
        }, 500);
    }

    hideError(element) {
        element.style.display = 'none';
    }

    setLoadingState(form, isLoading) {
        const button = form.querySelector('button[type="submit"]');
        button.disabled = isLoading;
        
        if (form.id === 'loginForm') {
            button.innerHTML = isLoading ? 
                '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...' :
                '<i class="bi bi-box-arrow-in-right me-2"></i>Login';
        } else {
            button.innerHTML = isLoading ? 
                '<span class="spinner-border spinner-border-sm me-2"></span>Creating account...' :
                'Create Account';
        }
    }

    checkSession() {
        const token = localStorage.getItem('authToken');
        const user = localStorage.getItem('user');

        if (token && user) {
            window.location.href = 'dashboard.html';
        }
    }

    static logout() {
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
        window.location.href = 'auth.html';
    }
}

// Initialize Auth when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing Auth...');
    window.auth = new Auth();
});

// Make logout function globally available
window.logout = () => Auth.logout();
