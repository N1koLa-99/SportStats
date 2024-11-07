document.addEventListener('DOMContentLoaded', async function () {
    const user = JSON.parse(localStorage.getItem('user'));

    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Display user information
    document.getElementById('first-name').textContent = user.firstName || 'Няма данни';
    document.getElementById('last-name').textContent = user.lastName || 'Няма данни';
    document.getElementById('age').textContent = user.age || 'Няма данни';
    document.getElementById('email').textContent = user.email || 'Няма данни';

    // Load profile picture
    if (user.id > 0) {
        try {
            const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/Users/profilePicture/${user.id}`);
            if (!response.ok) throw new Error('Неуспешно зареждане на профилната снимка');
            
            const imageBlob = await response.blob();
            document.getElementById('profile-image').src = URL.createObjectURL(imageBlob);
        } catch (error) {
            console.error(error.message);
            document.getElementById('profile-image').src = '../SportStatsImg/ProfilePhoto2.jpg';
            document.getElementById('profile-image').alt = 'Профилната снимка не е налична';
        }
    } else {
        document.getElementById('profile-image').src = '../SportStatsImg/ProfilePhoto2.jpg';
        document.getElementById('profile-image').alt = 'Профилната снимка не е налична';
    }

    // Profile image update functionality
    const editImageButton = document.getElementById('edit-image-button');
    const profileImageInput = document.getElementById('edit-profile-image');

    editImageButton.addEventListener('click', () => profileImageInput.click());

    profileImageInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/Users/uploadProfilePicture/${user.id}`, {
                    method: 'POST',
                    body: formData
                });
                if (!response.ok) throw new Error(await response.text());

                const data = await response.json();
                document.getElementById('profile-image').src = data.profileImage_url;

                // Update local storage
                user.profileImage_url = data.profileImage_url;
                localStorage.setItem('user', JSON.stringify(user));
            } catch (error) {
                console.error(error.message);
                alert('Грешка при качване на снимката: ' + error.message);
            }
        }
    });

    // Edit profile functionality
    const editProfileButton = document.getElementById('edit-profile');
    const saveProfileButton = document.getElementById('save-profile');
    const cancelProfileButton = document.getElementById('cancel-profile');
    const confirmPasswordInput = document.getElementById('edit-confirm-password');

    editProfileButton.addEventListener('click', () => {
        toggleEditFields(true);
        saveProfileButton.style.display = 'block';
        cancelProfileButton.style.display = 'block';
        editProfileButton.style.display = 'none';
    });

    cancelProfileButton.addEventListener('click', () => {
        toggleEditFields(false);
        saveProfileButton.style.display = 'none';
        cancelProfileButton.style.display = 'none';
        editProfileButton.style.display = 'block';
    });

    saveProfileButton.addEventListener('click', async () => {
        if (!user || !user.id) {
            alert('Потребителят не е валиден. Моля, влезте отново.');
            return;
        }

        const updatedUser = {
            firstName: document.getElementById('edit-first-name').value.trim(),
            lastName: document.getElementById('edit-last-name').value.trim(),
            age: document.getElementById('edit-age').value.trim(),
            email: document.getElementById('edit-email').value.trim(),
            password: document.getElementById('edit-password').value.trim(),
            confirmPassword: document.getElementById('edit-confirm-password').value.trim(),
            gender: document.querySelector('input[name="gender"]:checked')?.value
        };

        try {
            // Separate API calls for each field
            await updateField(user.id, 'firstName', updatedUser.firstName, 'Име');
            await updateField(user.id, 'lastName', updatedUser.lastName, 'Фамилия');
            await updateField(user.id, 'age', updatedUser.age, 'Години');
            await updateField(user.id, 'email', updatedUser.email, 'Имейл');

            if (updatedUser.password && updatedUser.password === updatedUser.confirmPassword) {
                await updateField(user.id, 'password', updatedUser.password, 'Парола');
            } else if (updatedUser.password) {
                alert('Паролите не съвпадат. Моля, опитайте отново.');
                return;
            }

            // Update displayed data and local storage
            document.getElementById('first-name').textContent = updatedUser.firstName || user.firstName;
            document.getElementById('last-name').textContent = updatedUser.lastName || user.lastName;
            document.getElementById('age').textContent = updatedUser.age || user.age;
            document.getElementById('email').textContent = updatedUser.email || user.email;

            localStorage.setItem('user', JSON.stringify({ ...user, ...updatedUser }));

            alert('Профилът е успешно обновен!');
            saveProfileButton.style.display = 'none';
            editProfileButton.style.display = 'block';
            toggleEditFields(false);
        } catch (error) {
            console.error(error.message);
            alert('Възникна грешка при обновяване на профила.');
        }
    });

    async function updateField(userId, field, value, fieldName) {
        if (!value) return;
        
        // Пътят до ендпоинта може да варира според API-то
        const endpoints = {
            firstName: `https://sportstatsapi.azurewebsites.net/api/Users/update-firstname/${userId}`,
            lastName: `https://sportstatsapi.azurewebsites.net/api/Users/updateLastName/${userId}`,
            age: `https://sportstatsapi.azurewebsites.net/api/Users/updateAge/${userId}`,
            email: `https://sportstatsapi.azurewebsites.net/api/Users/updateEmail/${userId}`,
            password: `https://sportstatsapi.azurewebsites.net/api/Users/updatePassword/${userId}`
        };
    
        const endpoint = endpoints[field];
        if (!endpoint) throw new Error(`Ендпоинт за ${field} не е намерен`);
    
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ value })  // Тялото трябва да съответства на формата, очакван от API-то
            });
            if (!response.ok) throw new Error(await response.text());
        } catch (error) {
            throw new Error(`Неуспешно обновяване на ${fieldName}: ${error.message}`);
        }
    }
    
    

    function toggleEditFields(editing) {
        ['first-name', 'last-name', 'age', 'email'].forEach(field => {
            document.getElementById(field).style.display = editing ? 'none' : 'inline';
            document.getElementById(`edit-${field}`).style.display = editing ? 'block' : 'none';
        });
        document.getElementById('edit-password').style.display = editing ? 'block' : 'none';
        document.getElementById('edit-confirm-password').style.display = editing ? 'block' : 'none';
    }

    try {
        const clubResponse = await fetch(`https://sportstatsapi.azurewebsites.net/api/Clubs/${user.clubID}`);
        if (!clubResponse.ok) throw new Error('Грешка при зареждане на информация за клуба.');

        const club = await clubResponse.json();
        document.getElementById('club').textContent = club.name || 'Няма данни';
    } catch (error) {
        console.error(error.message);
        document.getElementById('club').textContent = 'Грешка при зареждане на клуба';
    }
});
