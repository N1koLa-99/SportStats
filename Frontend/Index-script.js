document.addEventListener('DOMContentLoaded', function() {
    
    const yearOfBirthSelect = document.getElementById('yearOfBirth');
    const startYear = 1924;
    const endYear = 2020;

    for (let year = startYear; year <= endYear; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearOfBirthSelect.appendChild(option);
    }
    
    $('#yearOfBirth, #gender, #club').select2({
        placeholder: '',
        allowClear: true,
    });
    
    fetchClubs();

    const registrationForm = document.getElementById('registration-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const ageInput = document.getElementById('age');
    const genderInput = document.getElementById('gender');
    const clubInput = document.getElementById('club');
    
    const emailError = createErrorElement('email-error');
    const passwordError = createErrorElement('password-error');
    const firstNameError = createErrorElement('first-name-error');
    const lastNameError = createErrorElement('last-name-error');
    const ageError = createErrorElement('age-error');
    const genderError = createErrorElement('gender-error');
    const clubError = createErrorElement('club-error');
    
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

        // Email validation
        if (!emailPattern.test(emailInput.value)) {
            emailError.textContent = 'Моля, въведете валиден имейл адрес.';
            emailError.style.display = 'block';
            emailInput.classList.add('error');
            formIsValid = false;
        } else {
            try {
                const emailExists = await checkEmailAvailability(emailInput.value);
                if (emailExists) {
                    emailError.textContent = 'Този имейл вече е регистриран.Влезте в профила си от "Вход"';
                    emailError.style.display = 'block';
                    emailInput.classList.add('error');
                    formIsValid = false;
                } else {
                    emailError.textContent = '';
                    emailError.style.display = 'none';
                    emailInput.classList.remove('error');
                }
            } catch (error) {
                handleError('Грешка при проверка на имейла:', emailError, emailInput);
                formIsValid = false;
            }
        }

        // Password validation
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

        // Name validation
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

        // Age validation
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

        // Gender validation
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

        // Club validation
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
            const age = parseInt(formData.get('age'), 10);
            const yearOfBirth = parseInt(formData.get('yearOfBirth'), 10); // Потребителят въвежда годината на раждане
        
            const user = {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                email: formData.get('email'),
                password: formData.get('password'),
                age: age, // Възраст
                gender: formData.get('gender'),
                roleID: 1,
                clubID: parseInt(formData.get('club'), 10),
                profileImage_url: "http://localhost:7198/ProfilePictures/ProfilePhoto2.jpg",
                yearOfBirth: yearOfBirth 
            };
        
            try {
                const response = await fetch('https://localhost:7198/api/Users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(user)
                });
        
                if (!response.ok) {
                    throw new Error('Грешка при изпращане на данните: ' + response.statusText);
                }
        
                const newUser = await response.json();
                localStorage.setItem('user', JSON.stringify(newUser));
        
                // Показване на съобщение за успешна регистрация
                showMessageBox('Потребителят е регистриран успешно!', 'success');
        
                registrationForm.reset();
                window.location.href = "HomePage.html";
            } catch (error) {
                console.error('Грешка:', error);
                showMessageBox('Възникна грешка при регистрацията.Ако имейлът ви е зает влезте в профила си от "Вход" ', 'error');
            }
        }
        
    });

    const loginForm = document.getElementById('login-form');

    loginForm.addEventListener('submit', async function (event) {
        event.preventDefault();

        const formData = new FormData(loginForm);
        const loginData = {
            email: formData.get('login-email'),
            password: formData.get('login-password')
        };

        try {
            const response = await fetch('https://localhost:7198/api/Users/login', {
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
            localStorage.setItem('userHash', user.userTokenHash);

            showMessageBox('Входът е успешен! Добре дошли, ' + user.firstName + '!', 'success');

            window.location.href = user.roleID === 1 || user.roleID === 2 ? "HomePage.html" : "errorPage.html";
        } catch (error) {
            console.error('Грешка при влизането:', error);
            showMessageBox('Възникна грешка при влизането. Моля, проверете имейла и паролата и опитайте отново.', 'error');
        }
    });

    function createErrorElement(id) {
        const errorElement = document.createElement('div');
        errorElement.id = id;
        return errorElement;
    }

    function showMessageBox(message, type) {
        const messageBox = document.getElementById('message-box');
        const messageText = document.getElementById('message-text');
        messageText.textContent = message;
        messageBox.className = 'message-box ' + type;
        messageBox.style.display = 'block';

        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 5000);
    }

    async function checkEmailAvailability(email) {
        try {
            const response = await fetch(`https://localhost:7198/api/Users/email-exists/${email}`);
            if (!response.ok) {
                throw new Error('Грешка при проверка на имейла: ' + response.statusText);
            }
            const data = await response.json();
            return data.emailExists;
        } catch (error) {
            console.error('Грешка:', error);
            return false;
        }
    }

    function handleError(message, errorElement, inputElement) {
        console.error(message);
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        inputElement.classList.add('error');
    }

    async function fetchClubs() {
        try {
            const response = await fetch('https://localhost:7198/api/Clubs');
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