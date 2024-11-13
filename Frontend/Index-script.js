document.addEventListener('DOMContentLoaded', function() {
    // Зареждане на клубовете
    fetchClubs();

    const registrationForm = document.getElementById('registration-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const ageInput = document.getElementById('age');
    const genderInput = document.getElementById('gender');
    const clubInput = document.getElementById('club');
    
    const emailError = document.createElement('div');
    const passwordError = document.createElement('div');
    const firstNameError = document.createElement('div');
    const lastNameError = document.createElement('div');
    const ageError = document.createElement('div');
    const genderError = document.createElement('div');
    const clubError = document.createElement('div');
    
    emailError.id = 'email-error';
    passwordError.id = 'password-error';
    firstNameError.id = 'first-name-error';
    lastNameError.id = 'last-name-error';
    ageError.id = 'age-error';
    genderError.id = 'gender-error';
    clubError.id = 'club-error';
    
    emailInput.parentNode.insertBefore(emailError, emailInput.nextSibling);
    passwordInput.parentNode.insertBefore(passwordError, passwordInput.nextSibling);
    firstNameInput.parentNode.insertBefore(firstNameError, firstNameInput.nextSibling);
    lastNameInput.parentNode.insertBefore(lastNameError, lastNameInput.nextSibling);
    ageInput.parentNode.insertBefore(ageError, ageInput.nextSibling);
    genderInput.parentNode.insertBefore(genderError, genderInput.nextSibling);
    clubInput.parentNode.insertBefore(clubError, clubInput.nextSibling);

    const emailPattern = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    const passwordPattern = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
    const namePattern = /^[A-Za-zА-Яа-я]+$/; 
    const agePattern = /^(?:[1-9]|[1-9][0-9]|100)$/;


    registrationForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        let formIsValid = true;

        // Проверка на имейл
        if (!emailPattern.test(emailInput.value)) {
            emailError.textContent = 'Моля, въведете валиден имейл адрес.';
            emailError.style.display = 'block';
            emailInput.classList.add('error');
            formIsValid = false;
        } else {
            emailError.textContent = '';
            emailError.style.display = 'none';
            emailInput.classList.remove('error');
        }

        // По-строга проверка на парола
        if (!passwordPattern.test(passwordInput.value)) {
            passwordError.textContent = 'Поне 8 символа и да съдържа главна буква';
            passwordError.style.display = 'block';
            passwordInput.classList.add('error');
            formIsValid = false;
        } else {
            passwordError.textContent = '';
            passwordError.style.display = 'none';
            passwordInput.classList.remove('error');
        }

        // Проверка на първо и фамилно име (само букви)
        if (!namePattern.test(firstNameInput.value)) {
            firstNameError.textContent = 'Трябва да съдържа само букви.';
            firstNameError.style.display = 'block';
            firstNameInput.classList.add('error');
            formIsValid = false;
        } else {
            firstNameError.textContent = '';
            firstNameError.style.display = 'none';
            firstNameInput.classList.remove('error');
        }

        if (!namePattern.test(lastNameInput.value)) {
            lastNameError.textContent = 'Трябва да съдържа само букви.';
            lastNameError.style.display = 'block';
            lastNameInput.classList.add('error');
            formIsValid = false;
        } else {
            lastNameError.textContent = '';
            lastNameError.style.display = 'none';
            lastNameInput.classList.remove('error');
        }

        // Проверка за възраст (между 1 и 100)
        if (!agePattern.test(ageInput.value)) {
            ageError.textContent = 'Моля, въведете възраст между 1 и 100.';
            ageError.style.display = 'block';
            ageInput.classList.add('error');
            formIsValid = false;
        } else {
            ageError.textContent = '';
            ageError.style.display = 'none';
            ageInput.classList.remove('error');
        }

        // Проверка за пол (задължителен)
        if (!genderInput.value) {
            genderError.textContent = 'Моля, изберете пол.';
            genderError.style.display = 'block';
            genderInput.classList.add('error');
            formIsValid = false;
        } else {
            genderError.textContent = '';
            genderError.style.display = 'none';
            genderInput.classList.remove('error');
        }

        // Проверка за клуб (задължителен)
        if (!clubInput.value) {
            clubError.textContent = 'Моля, изберете отбор.';
            clubError.style.display = 'block';
            clubInput.classList.add('error');
            formIsValid = false;
        } else {
            clubError.textContent = '';
            clubError.style.display = 'none';
            clubInput.classList.remove('error');
        }

        if (formIsValid) {
            const formData = new FormData(registrationForm);
            const user = {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                email: formData.get('email'),
                password: formData.get('password'),
                age: parseInt(formData.get('age'), 10),
                gender: formData.get('gender'),
                roleID: 1,
                clubID: parseInt(formData.get('club'), 10),
                profileImage_url: "http://localhost:7198/ProfilePictures/ProfilePhoto2.jpg"
            };

            try {
                const response = await fetch('https://sportstatsapi.azurewebsites.net/api/Users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(user)
                });

                if (!response.ok) {
                    throw new Error('Грешка при изпращане на данните: ' + response.statusText);
                }

                const newUser = await response.json();
                localStorage.setItem('user', JSON.stringify(newUser));
                alert('Потребителят е регистриран успешно!');
                registrationForm.reset();
                window.location.href = "HomePage.html";
            } catch (error) {
                console.error('Грешка:', error);
                alert('Възникна грешка при регистрацията. Моля, опитайте отново.');
            }
        }
    });
    
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        const formData = new FormData(loginForm);
        const loginData = {
            email: formData.get('login-email'),
            password: formData.get('login-password')
        };

        try {
            const response = await fetch('https://sportstatsapi.azurewebsites.net/api/Users/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(loginData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error('Грешка при влизането: ' + (errorData.errors ? JSON.stringify(errorData.errors) : response.statusText));
            }

            const user = await response.json();
            localStorage.setItem('user', JSON.stringify(user));
            alert('Входът е успешен! Добре дошли, ' + user.firstName + '!');
            window.location.href = user.roleID === 1 || user.roleID === 2 ? "HomePage.html" : "errorPage.html";
        } catch (error) {
            console.error('Грешка при влизането:', error);
            alert('Възникна грешка при влизането. Моля, проверете имейла и паролата и опитайте отново.');
        }
    });

    async function fetchClubs() {
        try {
            const response = await fetch('https://sportstatsapi.azurewebsites.net/api/Clubs');
            if (!response.ok) {
                throw new Error('Грешка при извличане на данни от API: ' + response.statusText);
            }
            const clubs = await response.json();
            populateClubDropdown(clubs);
        } catch (error) {
            console.error('Грешка:', error);
        }
    }

    function populateClubDropdown(clubs) {
        const clubSelect = document.getElementById('club');
        clubSelect.innerHTML = '<option value="" disabled selected></option>';

        clubs.forEach(club => {
            const option = document.createElement('option');
            option.value = club.id;
            option.textContent = club.name;
            clubSelect.appendChild(option);
        });
    }

    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            const tabContent = document.getElementById(`${tabId}-form`);

            if (tabContent) {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabContents.forEach(content => content.classList.remove('active'));

                button.classList.add('active');
                tabContent.classList.add('active');
            } else {
                console.error(`Tab content with id ${tabId}-form not found.`);
            }
        });
    });
    
    function setupInputHints(input, hintId) {
        input.addEventListener('focus', () => {
            document.getElementById(hintId).style.display = 'block';
        });
        input.addEventListener('blur', () => {
            document.getElementById(hintId).style.display = 'none';
        });
    }

    setupInputHints(emailInput, 'email-hint');
    setupInputHints(passwordInput, 'password-hint');

    const inputs = document.querySelectorAll('.form-group input, .form-group select');

    inputs.forEach(input => {
        const label = input.nextElementSibling;
        if (label) {
            input.addEventListener('focus', () => {
                label.classList.add('hidden-label');
            });

            input.addEventListener('blur', () => {
                if (input.value === '') {
                    label.classList.remove('hidden-label');
                }
            });
        }
    });
});