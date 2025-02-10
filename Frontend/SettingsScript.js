document.addEventListener('DOMContentLoaded', async function () {
    const user = JSON.parse(localStorage.getItem('user'));
    const savedHash = localStorage.getItem('userHash');

    if (!user || !savedHash) {
        alert('Невалидни данни. Пренасочване към началната страница.');
        window.location.href = 'index.html';
        return;
    }

    const currentHash = await hashUserData(user);
    if (currentHash !== savedHash) {
        alert('Профилът беше променен. Моля, влезте отново.');
        localStorage.clear();
        window.location.href = 'index.html';
        return;
    }

    // Display user information
    displayUserInfo(user);

    // Load profile picture
    loadProfilePicture(user.id);

    // Profile image update functionality
    setupProfileImageUpdate(user.id);

    // Edit profile functionality
    setupProfileEditing(user);

    try {
        // Load club information
        const clubResponse = await fetch(`https://sportstatsapi.azurewebsites.net/api/Clubs/${user.clubID}`);
        if (!clubResponse.ok) throw new Error('Грешка при зареждане на информация за клуба.');

        const club = await clubResponse.json();
        document.getElementById('club').textContent = club.name || 'Няма данни';
    } catch (error) {
        console.error(error.message);
        document.getElementById('club').textContent = 'Грешка при зареждане на клуба';
    }
});

async function hashUserData(user) {
    const data = `${user.firstName}${user.lastName}${user.email}${user.gender}${user.roleID}${user.clubID}${user.profileImage_url}${user.id}${user.yearOfBirth}`;
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function displayUserInfo(user) {
    document.getElementById('first-name').textContent = user.firstName || 'Няма данни';
    document.getElementById('last-name').textContent = user.lastName || 'Няма данни';
    document.getElementById('year-of-birth').textContent = user.yearOfBirth || 'Няма данни';
    document.getElementById('email').textContent = user.email || 'Няма данни';
    loadYearOptions(user.yearOfBirth);
}

async function loadProfilePicture(userId) {
    try {
        const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/Users/profilePicture/${userId}`);
        if (!response.ok) throw new Error('Неуспешно зареждане на профилната снимка');

        const imageBlob = await response.blob();
        document.getElementById('profile-image').src = URL.createObjectURL(imageBlob);
    } catch (error) {
        console.error(error.message);
        document.getElementById('profile-image').src = '../SportStatsImg/ProfilePhoto2.jpg';
        document.getElementById('profile-image').alt = 'Профилната снимка не е налична';
    }
}

function setupProfileImageUpdate(userId) {
    const editImageButton = document.getElementById('edit-image-button');
    const profileImageInput = document.getElementById('edit-profile-image');

    editImageButton.addEventListener('click', () => profileImageInput.click());

    profileImageInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/Users/uploadProfilePicture/${userId}`, {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) throw new Error(await response.text());

                const data = await response.json();
                document.getElementById('profile-image').src = data.profileImage_url;

                // Update local storage
                const updatedUser = { ...JSON.parse(localStorage.getItem('user')), profileImage_url: data.profileImage_url };
                localStorage.setItem('user', JSON.stringify(updatedUser));
            } catch (error) {
                console.error(error.message);
                alert('Грешка при качване на снимката: ' + error.message);
            }
        }
    });
}

function setupProfileEditing(user) {
    const editProfileButton = document.getElementById('edit-profile');
    const saveProfileButton = document.getElementById('save-profile');
    const cancelProfileButton = document.getElementById('cancel-profile');

    editProfileButton.addEventListener('click', () => toggleEditFields(true));
    cancelProfileButton.addEventListener('click', () => toggleEditFields(false));

    saveProfileButton.addEventListener('click', async () => {
        try {
            await saveProfileChanges(user);
            toggleEditFields(false);
        } catch (error) {
            console.error(error.message);
            alert('Възникна грешка при обновяване на профила.');
        }
    });
}

async function saveProfileChanges(user) {
    const emailPattern = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    const passwordPattern = /^(?=.*[A-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
    const namePattern = /^[A-Za-zА-Яа-я]+$/;
    const yearOfBirthPattern = /^(?:[1-9][0-9]{3})$/;
   
    const updatedUser = {
        firstName: document.getElementById('edit-first-name').value.trim() || user.firstName,
        lastName: document.getElementById('edit-last-name').value.trim() || user.lastName,
        yearOfBirth: document.getElementById('edit-year-of-birth').value.trim() || user.yearOfBirth,
        email: document.getElementById('edit-email').value.trim() || user.email
    };

    // Validation
    if (!namePattern.test(updatedUser.firstName)) {
        alert('Името трябва да съдържа само букви.');
        return; 
    }

    if (!namePattern.test(updatedUser.lastName)) {
        alert('Фамилията трябва да съдържа само букви.');
        return; 
    }

    if (!yearOfBirthPattern.test(updatedUser.yearOfBirth)) {
        alert('Годината на раждане трябва да бъде валидна.');
        return;
    }

    if (!emailPattern.test(updatedUser.email)) {
        alert('Моля, въведете валиден имейл адрес (напр. user@example.com)');
        return;
    }

    const password = document.getElementById('edit-password').value.trim();
    const confirmPassword = document.getElementById('edit-confirm-password').value.trim();
    if (password && confirmPassword && password !== confirmPassword) {
        alert('Паролите не съвпадат. Моля, опитайте отново.');
        return;
    }
    if (password && !passwordPattern.test(password)) {
        alert('Паролата трябва да съдържа поне 8 символа, да включва главна буква и цифра.');
        return;
    }
    if (password && confirmPassword && password === confirmPassword) {
        updatedUser.password = password;
    }

    try {
        for (const [field, value] of Object.entries(updatedUser)) {
            if (value && value !== user[field]) {
                console.log(`Updating ${field} to ${value}`);
                await updateField(user.id, field, value, field);
            }
        }

        // Update local storage with the new user data
        const newUser = { ...user, ...updatedUser };
        localStorage.setItem('user', JSON.stringify(newUser));
        displayUserInfo(newUser);

        // Recalculate the hash and update localStorage with the new hash
        const newHash = await hashUserData(newUser);
        localStorage.setItem('userHash', newHash);  // Ensure hash is updated

        alert('Профилът е успешно обновен!');
    } catch (error) {
        console.error("Error updating profile: ", error.message);
        alert('Възникна грешка при обновяване на профила.');
    }
}

function loadYearOptions(selectedYear) {
    const yearSelect = document.getElementById('edit-year-of-birth');
    const currentYear = new Date().getFullYear();
    
    for (let year = currentYear - 100; year <= currentYear; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === selectedYear) {
            option.selected = true;
        }
        yearSelect.appendChild(option);
    }
}

async function updateField(userId, fieldName, value, fieldLabel) {
    try {
        const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/Users/${userId}/update-${fieldName}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(value)
        });
        if (!response.ok) throw new Error(`Грешка при актуализиране на ${fieldLabel}`);
    } catch (error) {
        console.error(error.message);
        alert(error.message);
        throw error;
    }
}

function toggleEditFields(editing) {
    ['first-name', 'last-name', 'year-of-birth', 'email'].forEach(field => {
        document.getElementById(field).style.display = editing ? 'none' : 'inline';
        document.getElementById(`edit-${field}`).style.display = editing ? 'block' : 'none';
    });
    document.getElementById('edit-password').style.display = editing ? 'block' : 'none';
    document.getElementById('edit-confirm-password').style.display = editing ? 'block' : 'none';

    document.getElementById('save-profile').style.display = editing ? 'block' : 'none';
    document.getElementById('cancel-profile').style.display = editing ? 'block' : 'none';
    document.getElementById('edit-profile').style.display = editing ? 'none' : 'block';
}
