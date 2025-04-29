document.addEventListener('DOMContentLoaded', function() {
   
    window.addEventListener("DOMContentLoaded", () => {
        const params = new URLSearchParams(window.location.search);
        const formType = params.get("form");

        const loginTab = document.querySelector('[data-tab="login"]');
        const regTab = document.querySelector('[data-tab="registration"]');
        const loginForm = document.getElementById("login-form");
        const regForm = document.getElementById("registration-form");

        if (formType === "signup") {
            regTab.classList.add("active");
            loginTab.classList.remove("active");
            regForm.classList.add("active");
            loginForm.classList.remove("active");
        } else {
            loginTab.classList.add("active");
            regTab.classList.remove("active");
            loginForm.classList.add("active");
            regForm.classList.remove("active");
        }
    });

    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        const user = JSON.parse(savedUser);
        showMessageBox(`Здравей, ${user.firstName}!`, 'success');

        // Пренасочване след кратко време
        setTimeout(() => {
            window.location.href = user.roleID === 1 || user.roleID === 2 ? "HomePage.html" : "errorPage.html";
        }, 1000);
    
    }
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
        const genderInput = document.getElementById('gender');
        const clubInput = document.getElementById('club');
    
        const emailError = createErrorElement('email-error');
        const passwordError = createErrorElement('password-error');
        const firstNameError = createErrorElement('first-name-error');
        const lastNameError = createErrorElement('last-name-error');
        const genderError = createErrorElement('gender-error');
        const clubError = createErrorElement('club-error');
    
        emailInput.parentNode.insertBefore(emailError, emailInput.nextSibling);
        passwordInput.parentNode.insertBefore(passwordError, passwordInput.nextSibling);
        firstNameInput.parentNode.insertBefore(firstNameError, firstNameInput.nextSibling);
        lastNameInput.parentNode.insertBefore(lastNameError, lastNameInput.nextSibling);
        genderInput.parentNode.insertBefore(genderError, genderInput.nextSibling);
        clubInput.parentNode.insertBefore(clubError, clubInput.nextSibling);
    
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|bg|org|net|info|edu|gov|biz|co\.uk)$/i;
        const passwordPattern = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
        const namePattern = /^[A-Za-zА-Яа-я]+$/;
    
        let emailTimeout;
    
        emailInput.addEventListener('input', function () {
            clearTimeout(emailTimeout);
            emailTimeout = setTimeout(async () => {
                if (!emailPattern.test(emailInput.value)) {
                    showError(emailError, emailInput, 'Моля, въведете валиден имейл адрес.');
                    return;
                }
    
                try {
                    const emailExists = await checkEmailAvailability(emailInput.value);
                    if (emailExists) {
                        showError(emailError, emailInput, 'Имейлът вече е зает. Опитайте с друг.');
                    } else {
                        hideError(emailError, emailInput);
                    }
                } catch (error) {
                    console.error('Грешка при проверка на имейла:', error);
                }
            }, 500);
        });
    
        registrationForm.addEventListener('submit', async function (event) {
            event.preventDefault();
            let formIsValid = true;
    
            // Email validation
            if (!emailPattern.test(emailInput.value)) {
                showError(emailError, emailInput, 'Моля, въведете валиден имейл адрес.');
                formIsValid = false;
            } else {
                try {
                    const emailExists = await checkEmailAvailability(emailInput.value);
                    if (emailExists) {
                        showError(emailError, emailInput, 'Този имейл вече е регистриран.');
                        formIsValid = false;
                    } else {
                        hideError(emailError, emailInput);
                    }
                } catch (error) {
                    console.error('Грешка при проверка на имейла:', error);
                    showError(emailError, emailInput, 'Грешка при проверка на имейла.');
                    formIsValid = false;
                }
            }
    
            validateField(passwordInput, passwordError, passwordPattern, 'Паролата трябва да съдържа поне 8 символа, една главна буква и цифра.', formIsValid);
            validateField(firstNameInput, firstNameError, namePattern, 'Трябва да съдържа само букви.', formIsValid);
            validateField(lastNameInput, lastNameError, namePattern, 'Трябва да съдържа само букви.', formIsValid);
    
            if (!genderInput.value) {
                showError(genderError, genderInput, 'Моля, изберете пол.');
                formIsValid = false;
            } else {
                hideError(genderError, genderInput);
            }
    
            if (!clubInput.value) {
                showError(clubError, clubInput, 'Моля, изберете отбор.');
                formIsValid = false;
            } else {
                hideError(clubError, clubInput);
            }
    
            if (!formIsValid) return;
    
            const formData = new FormData(registrationForm);
            const user = {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                email: formData.get('email'),
                password: formData.get('password'),
                gender: formData.get('gender'),
                roleID: 1,
                clubID: parseInt(formData.get('club'), 10),
                profileImage_url: "https://sportstatsapi.azurewebsites.net/ProfilePictures/ProfilePhoto2.jpg",
                yearOfBirth: parseInt(formData.get('yearOfBirth'), 10),
                statusID: 1
            };
    
            try {
                const response = await fetch('https://sportstatsapi.azurewebsites.net/api/Users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(user),
                });
    
                if (!response.ok) {
                    throw new Error('Грешка при изпращане на данните: ' + response.statusText);
                }
    
                const newUser = await response.json();
                localStorage.setItem('user', JSON.stringify(newUser.user));
                localStorage.setItem('userHash', newUser.userTokenHash);
    
                await sendApprovalRequest(newUser.user);
    
                showMessageBox('Потребителят е регистриран успешно!', 'success');
                registrationForm.reset();
                window.location.href = "HomePage.html";
            } catch (error) {
                console.error('Грешка:', error);
                showMessageBox('Възникна грешка при регистрацията.', 'error');
            }
        });
    
        async function checkEmailAvailability(email) {
            try {
                const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/Users/check-email?email=${email}`);
                if (!response.ok) {
                    throw new Error('Грешка при проверка на имейла: ' + response.statusText);
                }
                const data = await response.json();
                
                // Увери се, че API връща правилен ключ
                return data.exists;  // Ако API връща `data.exists`
            } catch (error) {
                console.error('Грешка:', error);
                return false;  // По-добре да върнем false, за да не блокира регистрацията
            }
        }
    
        function showError(errorElement, inputElement, message) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            inputElement.classList.add('error');
        }
    
        function hideError(errorElement, inputElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
            inputElement.classList.remove('error');
        }
    
        function validateField(input, errorElement, pattern, message, formIsValid) {
            if (!pattern.test(input.value)) {
                showError(errorElement, input, message);
                return false;
            } else {
                hideError(errorElement, input);
                return formIsValid;
            }
        }
    
        function createErrorElement(id) {
            const errorElement = document.createElement('div');
            errorElement.id = id;
            errorElement.classList.add('error-message');
            errorElement.style.display = 'none';
            return errorElement;
        }    
            // Функция за изпращане на заявка за одобрение
        async function sendApprovalRequest(user) {
            try {
                const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/approvalRequests`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: user.id,
                        clubId: user.clubID,
                        status: "pending"
                    }),
                });
        
                if (!response.ok) {
                    throw new Error('Грешка при изпращане на заявката за одобрение: ' + response.statusText);
                }
        
                console.log('Заявката за одобрение е изпратена успешно!');
            } catch (error) {
                console.error('Грешка при изпращане на заявката за одобрение:', error);
            }
        }   
    });

    document.addEventListener('DOMContentLoaded', function () {
        // Проверка дали има запазен потребител и автоматично влизане
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            const user = JSON.parse(savedUser);
            showMessageBox(`Добре дошъл обратно, ${user.firstName}!`, 'success');
    
            // Пренасочване след кратко време
            setTimeout(() => {
                window.location.href = user.roleID === 1 || user.roleID === 2 ? "HomePage.html" : "errorPage.html";
            }, 1500);
        }
    
        // Динамично добавяне на години в падащото меню
        const yearOfBirthSelect = document.getElementById('yearOfBirth');
        const startYear = 1924;
        const endYear = new Date().getFullYear();
    
        for (let year = startYear; year <= endYear; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearOfBirthSelect.appendChild(option);
        }
    
        // Активиране на Select2 за стилни dropdown менюта
        $('#yearOfBirth, #gender, #club').select2({
            placeholder: '',
            allowClear: true,
        });
    
        fetchClubs();
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

            // Запазване в localStorage за автоматично логване
            localStorage.setItem('user', JSON.stringify(user));
            localStorage.setItem('userHash', user.userTokenHash);

            showMessageBox(`Входът е успешен! Добре дошли, ${user.firstName}!`, 'success');

            // Пренасочване към началната страница
            setTimeout(() => {
                window.location.href = user.roleID === 1 || user.roleID === 2 ? "HomePage.html" : "errorPage.html";
            }, 1000);
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
            const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/Users/email-exists/${email}`);
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

    document.querySelector('.tab-button[data-tab="login"]').classList.add('active');
    document.getElementById('login-form').classList.add('active');


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