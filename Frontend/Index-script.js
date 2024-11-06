
document.addEventListener('DOMContentLoaded', function() {
    // Зареждане на клубовете
    fetchClubs();

    const registrationForm = document.getElementById('registration-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const emailError = document.createElement('div');
    const passwordError = document.createElement('div');
    emailError.id = 'email-error';
    passwordError.id = 'password-error';
    emailInput.parentNode.insertBefore(emailError, emailInput.nextSibling);
    passwordInput.parentNode.insertBefore(passwordError, passwordInput.nextSibling);

    const emailPattern = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    const passwordPattern = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;

    // Валидация при изпращане на регистрационната форма
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
            passwordError.textContent = 'Паролата трябва да е поне 8 символа и да съдържа главна буква';
            passwordError.style.display = 'block';
            passwordInput.classList.add('error');
            formIsValid = false;
        } else {
            passwordError.textContent = '';
            passwordError.style.display = 'none';
            passwordInput.classList.remove('error');
        }

        // Ако всички проверки са преминати, изпрати формата
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

    // Обработчик на формата за вход
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

    // Функция за извличане на клубовете
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

    // Функция за попълване на падащото меню за клубове
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

    // Управление на табовете
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
    // Показване и скриване на подсказки и заглавия
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

    // Управление на заглавията
    const inputs = document.querySelectorAll('.form-group input, .form-group select');

    inputs.forEach(input => {
        const label = input.nextElementSibling; // Следващият елемент след input е label
        if (label) {
            input.addEventListener('focus', () => {
                label.classList.add('hidden-label'); // Скриване на заглавието
            });

            input.addEventListener('blur', () => {
                if (input.value === '') {
                    label.classList.remove('hidden-label'); // Показване на заглавието, ако полето е празно
                }
            });
        }
    });
});
