document.addEventListener('DOMContentLoaded', function () {
    const user = JSON.parse(localStorage.getItem('user'));

    if (user) {
        // Включи показването на информацията за профила
        document.getElementById('first-name').textContent = user.firstName || 'Няма данни';
        document.getElementById('last-name').textContent = user.lastName || 'Няма данни';
        document.getElementById('age').textContent = user.age || 'Няма данни';
        document.getElementById('email').textContent = user.email || 'Няма данни';

        // Зареждане на профилната снимка
        if (user.id > 0) {
            fetch(`https://sportstatsapi.azurewebsites.net/api/Users/profilePicture/${user.id}`)
                .then(response => {
                    if (!response.ok) {
                        console.error('Неуспешно зареждане на профилната снимка:', response.status, response.statusText);
                        throw new Error('Неуспешно зареждане на профилната снимка');
                    }
                    return response.blob();
                })
                .then(imageBlob => {
                    const imageUrl = URL.createObjectURL(imageBlob);
                    document.getElementById('profile-image').src = imageUrl; // Вмъкни профилната снимка
                })
                .catch(error => {
                    console.error('Грешка при зареждане на профилната снимка:', error);
                    document.getElementById('profile-image').src = '../SportStatsImg/ProfilePhoto2.jpg';
                    document.getElementById('profile-image').alt = 'Профилната снимка не е налична';
                });
        } else {
            console.warn('Невалиден user.id:', user.id);
            document.getElementById('profile-image').src = '../SportStatsImg/ProfilePhoto2.jpg';
            document.getElementById('profile-image').alt = 'Профилната снимка не е налична';
        }

        const editImageButton = document.getElementById('edit-image-button');
        const profileImageInput = document.getElementById('edit-profile-image');

        // Функционалност за смяна на профилната снимка
        editImageButton.addEventListener('click', function () {
            profileImageInput.click();
        });

        profileImageInput.addEventListener('change', function (event) {
            const file = event.target.files[0];
            if (file) {
                const formData = new FormData();
                formData.append('file', file);
        
                // Изпрати заявка за качване на снимката към API-то
                fetch(`https://sportstatsapi.azurewebsites.net/api/Users/uploadProfilePicture/${user.id}`, {
                    method: 'POST',
                    body: formData
                })
                .then(response => {
                    if (!response.ok) {
                        return response.text().then(text => {
                            throw new Error(`Грешка при качване на снимката: ${text}`);
                        });
                    }
                    return response.json(); // Очакваме JSON
                })
                .then(data => {
                    const imageUrl = data.profileImage_url; // Вземи URL на новата снимка
                    document.getElementById('profile-image').src = imageUrl;
        
                    // Обнови профилната снимка в локалното съхранение
                    user.profileImage_url = imageUrl; // Актуализирай снимката
                    localStorage.setItem('user', JSON.stringify(user));
                })
                .catch(error => {
                    console.error('Грешка при качване на снимката:', error);
                    alert('Грешка при качване на снимката: ' + error.message);
                });
            }
        });
        
        // Функционалност за редактиране на информацията за профила
        const editProfileButton = document.getElementById('edit-profile');
        const saveProfileButton = document.getElementById('save-profile');
        const cancelProfileButton = document.getElementById('cancel-profile');
        const confirmPasswordInput = document.getElementById('edit-confirm-password');
        
        editProfileButton.addEventListener('click', function () {
            toggleEditFields(true);
            saveProfileButton.style.display = 'block';  // Показва бутона "Запази"
            cancelProfileButton.style.display = 'block'; // Показва бутона "Назад"
            editProfileButton.style.display = 'none';    // Скрива бутона "Редактирай"
            
            // Показва полето за потвърдителна парола
            confirmPasswordInput.style.display = 'block';
        });
        
        cancelProfileButton.addEventListener('click', function () {
            toggleEditFields(false); // Скрива полетата за редактиране
            saveProfileButton.style.display = 'none'; // Скрива бутона "Запази"
            cancelProfileButton.style.display = 'none'; // Скрива бутона "Назад"
            editProfileButton.style.display = 'block'; // Показва бутона "Редактирай"
        });

        saveProfileButton.addEventListener('click', function () {
            if (!user || !user.id) {
                alert('Потребителят не е валиден. Моля, влезте отново.');
                return;
            }
        
            // Събиране на новите данни от формата
            const updatedUser = {
                id: user.id,
                firstName: document.getElementById('edit-first-name').value.trim() || user.firstName,
                lastName: document.getElementById('edit-last-name').value.trim() || user.lastName,
                age: document.getElementById('edit-age').value.trim() || user.age,
                email: document.getElementById('edit-email').value.trim() || user.email,
                password: document.getElementById('edit-password').value.trim() || user.password,
                gender: document.querySelector('input[name="gender"]:checked')?.value || user.gender,
                profileImage_url: user.profileImage_url // Запази текущата снимка
            };
        
            const confirmPassword = document.getElementById('edit-confirm-password').value.trim();
            if (updatedUser.password && updatedUser.password !== confirmPassword) {
                alert('Паролите не съвпадат. Моля, опитайте отново.');
                return;
            }
        
            // Премахване на полета, които не са променени
            const updateData = {
                id: updatedUser.id,
                firstName: updatedUser.firstName,
                lastName: updatedUser.lastName,
                email: updatedUser.email,
                gender: updatedUser.gender,
                // Запази текущата профилна снимка
                profileImage_url: user.profileImage_url,
            };
        
            // Добави проверка за задължителни полета
            if (!updateData.firstName || !updateData.lastName || !updateData.email || !updateData.gender) {
                alert('Моля, попълнете всички задължителни полета: Име, Фамилно име, Имейл и Пол.');
                return;
            }
        
            // Добави останалите полета, само ако са променени
            if (updatedUser.age !== user.age) updateData.age = updatedUser.age;
            if (updatedUser.password) updateData.password = updatedUser.password; // Тук добавяш новата парола
        
            // Проверка дали updateData е празен
            if (Object.keys(updateData).length === 1) { // Само с ID-то
                alert('Няма променени данни за обновяване.');
                return;
            }
        
            // Извикване на функцията за обновяване на профила
            updateUserProfile(updateData).then(() => {
                // Обновяване на полетата в HTML
                if (updateData.firstName) document.getElementById('first-name').textContent = updateData.firstName;
                if (updateData.lastName) document.getElementById('last-name').textContent = updateData.lastName;
                if (updateData.age) document.getElementById('age').textContent = updateData.age;
                if (updateData.email) document.getElementById('email').textContent = updateData.email;
        
                alert('Профилът е успешно обновен!');
        
                // Скрива бутоните за запазване и показва бутона за редактиране
                saveProfileButton.style.display = 'none';
                editProfileButton.style.display = 'block';
        
                toggleEditFields(false);
        
                // Актуализиране на локалното съхранение
                localStorage.setItem('user', JSON.stringify({...user, ...updateData}));
            }).catch(error => {
                console.error('Грешка при обновяване на профила:', error);
                alert('Възникна грешка при обновяване на профила.');
            });
        });
              

        function toggleEditFields(editing) {
            document.getElementById('edit-first-name').style.display = editing ? 'block' : 'none';
            document.getElementById('edit-last-name').style.display = editing ? 'block' : 'none';
            document.getElementById('edit-age').style.display = editing ? 'block' : 'none';
            document.getElementById('edit-email').style.display = editing ? 'block' : 'none';
            document.getElementById('edit-password').style.display = editing ? 'block' : 'none';
            document.getElementById('edit-confirm-password').style.display = editing ? 'block' : 'none';
        
            document.getElementById('first-name').style.display = editing ? 'none' : 'inline';
            document.getElementById('last-name').style.display = editing ? 'none' : 'inline';
            document.getElementById('age').style.display = editing ? 'none' : 'inline';
            document.getElementById('email').style.display = editing ? 'none' : 'inline';
            document.getElementById('password').style.display = editing ? 'none' : 'inline';
        }
        
        function updateUserProfile(data) {
            console.log('Updating user profile with data:', data); 
            return fetch(`https://sportstatsapi.azurewebsites.net/api/Users/${data.id}`, { 
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data) 
            })
            .then(response => {
                if (!response.ok) {
                    return response.text().then(text => {
                        throw new Error(`Профилът не можа да бъде обновен: ${text}`);
                    });
                }
            });
        }
        
        // Получаване на информация за клуба
        fetch(`https://sportstatsapi.azurewebsites.net/api/Clubs/${user.clubID}`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(club => {
            const clubName = club.name || 'Няма данни';
            document.getElementById('club').textContent = clubName; // Увери се, че club е валиден
        })
        .catch(error => {
            console.error('Грешка при извличане на информация за клуба:', error);
            document.getElementById('club').textContent = 'Грешка при зареждане на клуба'; // Увери се, че клубът е дефиниран
        });

    } else {
        window.location.href = 'index.html';
    }
});
