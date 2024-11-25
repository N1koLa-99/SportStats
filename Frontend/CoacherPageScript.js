document.addEventListener('DOMContentLoaded', async function () {
    const user = JSON.parse(localStorage.getItem('user'));
    console.log('User:', user); // Логване на потребителя
    
    async function fetchJson(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            console.log('Fetched data from', url, ':', data); // Логване на данните от API
            return data;
        } catch (error) {
            console.error('Грешка при извличане на данни:', error);
            throw error;
        }
    }
    async function deleteResult(resultId) {
        // Prompt for confirmation
        const confirmation = prompt('Сигурни ли сте, че искате да изтриете резултата? Напишете 1 за потвърждение.');
        if (confirmation !== '1') {
            alert('Изтриването е отменено.');
            return; // Exit the function if not confirmed
        }
    
        try {
            const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/Results/${resultId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
    
            if (!response.ok) {
                throw new Error('Неуспешно изтриване на резултата');
            }
    
            alert('Резултатът е изтрит успешно!');
            // Обновяване на показаните резултати
            const disciplineId = Number(document.getElementById('discipline').value);
            const clubUsers = await fetchJson(`https://sportstatsapi.azurewebsites.net/Users/club/${user.clubID}`);
            const results = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/Results`);
            displayUsersTable(clubUsers, results, disciplineId);
        } catch (error) {
            alert('Грешка при изтриване на резултата.');
            console.error('Грешка:', error);
        }
    }
    

    function populateDropdown(elementId, items, textProperty, valueProperty) {
        const select = document.getElementById(elementId);
        if (select) {
            select.innerHTML = '<option value="" disabled selected>Изберете опция</option>';
            items.forEach(item => {
                const option = document.createElement('option');
                option.value = item[valueProperty];
                option.textContent = typeof textProperty === 'function' ? textProperty(item) : item[textProperty] || `Опция ${item[valueProperty]}`;
                select.appendChild(option);
            });
            console.log('Populated dropdown with ID:', elementId); // Логване на попълнените данни
        }
    }

    function displayUsersTable(users, results, disciplineId = null) {
        const usersTable = document.getElementById('users-table');
        const tbody = usersTable.querySelector('tbody');
        tbody.innerHTML = '';
        console.log('Показване на таблицата с потребители с ID на дисциплината:', disciplineId);
    
        users.forEach(user => {
            const userResults = disciplineId 
                ? results.filter(result => result.userId === user.id && result.disciplineId == disciplineId)
                : [];
            
            console.log('Потребител:', user.firstName, user.lastName, 'Резултати:', userResults); // Логване на резултатите на потребителя
            
            const bestResult = userResults.length > 0
                ? getBestResult(userResults, disciplineId)
                : 'Няма резултат';
    
                const resultEntries = userResults
                .map(result => `
                    <tr>
                        <td>${formatResult(result.valueTime, disciplineId)}</td>
                        <td>${new Date(result.resultDate).toLocaleDateString()}</td>
                        <td>
                            <button class="delete-result" data-result-id="${result.id}" title="Изтрий">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>`)
                .join('');
            
    
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.firstName}</td>
                <td>${user.lastName}</td>
                <td>${user.age}</td>
                <td>${disciplineId ? bestResult : ''}</td>
                <td>
                    <table>
                        <tbody>
                            ${resultEntries || (disciplineId ? '<tr><td colspan="3">Няма резултати</td></tr>' : '')}
                        </tbody>
                    </table>
                </td>
            `;
            tbody.appendChild(row);
        });
    
        // Добавяне на обработчици на събития за бутоните за изтриване
        document.querySelectorAll('.delete-result').forEach(button => {
            button.addEventListener('click', async function () {
                const resultId = this.getAttribute('data-result-id');
                await deleteResult(resultId);
            });
        });
    }
    
    
    async function handleCoach() {
        if (!user || user.roleID !== 2) {
            alert('Няма достъп до тази страница.');
            window.location.href = 'HomePage.html';
            return;
        }
    
        document.getElementById('coach-name').textContent = `${user.firstName} ${user.lastName}`;
    
        try {
            const disciplines = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/ClubDisciplines/disciplines-by-club/${user.clubID}`);
            populateDropdown('discipline', disciplines, 'disciplineName', 'id');
    
            const clubUsers = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/Users/club/${user.clubID}`);
            let results = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/Results`);
    
            // Първоначално зареждаме потребителите без резултати
            displayUsersTable(clubUsers, results);
    
            document.getElementById('discipline').addEventListener('change', function () {
                const disciplineId = Number(this.value); // Преобразуване на стойността в число
                console.log('Discipline changed to:', disciplineId);
                const filteredResults = results.filter(result => result.disciplineId === disciplineId);
                displayUsersTable(clubUsers, filteredResults, disciplineId);
            });
    
            document.getElementById('add-user').addEventListener('change', function () {
                const userId = this.value;  // Вземи ID на избрания потребител
                const userProfilePicture = document.getElementById('user-profile-picture');
                
                // Скриване на изображението, ако няма избран потребител
                if (!userId) {
                    userProfilePicture.style.display = 'none'; 
                    return;
                }
            
                // Извличане на данните за избрания потребител и профилната снимка
                Promise.all([
                    fetch(`https://sportstatsapi.azurewebsites.net/api/Users/${userId}`), // Извличане на данни за потребителя
                    fetch(`https://sportstatsapi.azurewebsites.net/api/Users/profilePicture/${userId}`) // Извличане на профилната снимка с правилното userId
                ])
                .then(responses => {
                    // Проверка на статусите на отговорите
                    if (!responses[0].ok) throw new Error('Неуспешно зареждане на данни за потребителя');
                    if (!responses[1].ok) throw new Error('Неуспешно зареждане на профилната снимка');
                    
                    return Promise.all([responses[0].json(), responses[1].blob()]); // Преобразуване на отговорите
                })
                .then(([user, imageBlob]) => {
                    console.log('Избран потребител:', user); // Логни потребителските данни
                    console.log('Възраст:', user.age); // Логни възрастта
                    console.log('Пол:', user.gender); // Логни пола
                    
                    // Обновяване на изображението
                    const imageUrl = URL.createObjectURL(imageBlob);
                    userProfilePicture.src = imageUrl;
                    userProfilePicture.style.display = 'block'; // Показване на изображението
                    userProfilePicture.alt = 'Профилна снимка на избрания потребител';
                })
                .catch(error => {
                    console.error('Грешка:', error);
                    userProfilePicture.src = '../SportStatsImg/ProfilePhoto2.jpg'; // Резервна снимка при грешка
                    userProfilePicture.alt = 'Профилната снимка не е налична';
                    userProfilePicture.style.display = 'block'; // Показване на резервното изображение
                });
            });
            
            
        
            // Обработчик на събития за търсене по име и фамилия
            document.getElementById('search-form').addEventListener('submit', function (event) {
                event.preventDefault();
                const firstName = document.getElementById('first-name').value.trim().toLowerCase();
                const lastName = document.getElementById('last-name').value.trim().toLowerCase();
    
                const disciplineId = Number(document.getElementById('discipline').value); // Преобразуване на стойността в число
    
                console.log('Search submitted with first name:', firstName, 'last name:', lastName, 'disciplineId:', disciplineId);
    
                const filteredUsers = clubUsers.filter(user =>
                    user.firstName.toLowerCase() === firstName &&
                    user.lastName.toLowerCase() === lastName
                );
    
                if (filteredUsers.length === 0) {
                    alert('Не бяха намерени потребители с тези имена.');
                    displayUsersTable([], results, disciplineId);
                } else {
                    displayUsersTable(filteredUsers, results, disciplineId);
                }
            });
    
        } catch (error) {
            alert('Не можа да се извлекат данните.');
            console.error('Грешка при извличане на данни:', error);
        }
    }    

    function getBestResult(results, disciplineId) {
        const timeBasedIds = [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18
        ];
        
        console.log('Discipline ID:', disciplineId);
        console.log('Time-based IDs:', timeBasedIds);
        
        const isTimeBased = timeBasedIds.includes(Number(disciplineId)); // Преобразуване на disciplineId в число
        
        console.log('Is time-based:', isTimeBased);
        
        let bestResult;
        if (isTimeBased) {
            bestResult = results.reduce((best, result) => {
                return result.valueTime < best.valueTime ? result : best;
            }, results[0]);
        } else {
            bestResult = results.reduce((best, result) => {
                return result.valueTime > best.valueTime ? result : best;
            }, results[0]);
        }
        
        return formatResult(bestResult.valueTime, disciplineId);
    }
    
    function formatResult(valueTime, disciplineId) {
        const timeBasedIds = [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18
        ];
        
        console.log('Formatting result for discipline ID:', disciplineId);

        if (typeof valueTime !== 'number' || isNaN(valueTime)) {
            return 'Неизвестна стойност';
        }

        if (timeBasedIds.includes(Number(disciplineId))) {
            // Форматиране на времената като час/мин/сек/ст
            const formattedTime = formatTime(valueTime);
            console.log('Formatted result (time-based):', formattedTime);
            return formattedTime;
        } else {
            // Връщане на числовата стойност в оригинален вид
            const formattedNumber = valueTime.toFixed(2);
            console.log('Formatted result (number-based):', formattedNumber);
            return formattedNumber;
        }
    }
    
    function formatTime(seconds) {
        if (seconds === undefined || seconds === null || isNaN(seconds)) {
            return 'Неизвестна стойност';
        }
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        const millis = Math.round((seconds % 1) * 100); // Стотни от секундата

        // Сглобяване на резултата
        let timeString = '';
        if (hours > 0) timeString += `${hours} ч `;
        if (minutes > 0 || hours > 0) timeString += `${minutes} мин `;
        timeString += `${secs}.${millis} сек`;
        return timeString;
    }
    
    async function setupAddResultForm() {
        // Зареждане на дисциплините и потребителите в падащите менюта
        const disciplines = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/ClubDisciplines/disciplines-by-club/${user.clubID}`);
        populateDropdown('add-discipline', disciplines, 'disciplineName', 'id'); // Показваме само име на дисциплината
    
        const clubUsers = await fetchJson(`https://sportstatsapi.azurewebsites.net/api/Users/club/${user.clubID}`);
        populateDropdown('add-user', clubUsers, user => `${user.firstName} ${user.lastName} (${user.age})`, 'id'); // Показваме пълно име и години
    
        document.getElementById('add-discipline').addEventListener('change', function () {
            const disciplineId = this.value;
            const timeBasedIds = [
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18
            ];
            const isTimeBased = timeBasedIds.includes(Number(disciplineId));
    
            document.getElementById('time-input').style.display = isTimeBased ? 'block' : 'none';
            document.getElementById('decimal-input').style.display = isTimeBased ? 'none' : 'block';
        });
    
        // Извикване при натискане на бутона за добавяне на резултат
        document.getElementById('submit-result').addEventListener('click', async function () {
            const disciplineId = document.getElementById('add-discipline').value;
            const userId = document.getElementById('add-user').value;
            const isTimeBased = document.getElementById('time-input').style.display === 'block';
        
            let valueTime;
            if (isTimeBased) {
                const hours = parseInt(document.getElementById('hours').value, 10) || 0;
                const minutes = parseInt(document.getElementById('minutes').value, 10) || 0;
                const seconds = parseInt(document.getElementById('seconds').value, 10) || 0;
                const milliseconds = parseInt(document.getElementById('milliseconds').value, 10) || 0;
                valueTime = hours * 3600 + minutes * 60 + seconds + milliseconds / 100;
            } else {
                valueTime = parseFloat(document.getElementById('decimal-result').value);
            }
        
            console.log('Submitting result:', { disciplineId, userId, valueTime });
        
            if (isNaN(valueTime) || valueTime === undefined) {
                alert('Моля, въведете валиден резултат.');
                return;
            }
        
            try {
                const response = await fetch('https://sportstatsapi.azurewebsites.net/api/Results', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: userId,
                        disciplineId: disciplineId,
                        valueTime: valueTime,
                        resultDate: new Date().toISOString() // текущата дата и час
                    })
                });
        
                if (!response.ok) {
                    const errorText = await response.text(); // Capture the error response text
                    console.error('Failed to add result:', { status: response.status, errorText });
                    throw new Error('Неуспешно добавяне на резултата');
                }
        
                const responseData = await response.json(); // Assuming your API returns the response data
                alert('Резултатът е добавен успешно!');
        
                // Сравняване на резултата с нормативите
                const isQualified = await compareResultWithNorms(userId, disciplineId, valueTime);
                
                // Ако е покрит нормативът, добавяме точки в Rankings
                if (isQualified) {
                    const points = 50; // Определете колко точки да добавите
                    await addPointsToRankings(userId, disciplineId, points);
                }
        
            } catch (error) {
                alert('Грешка при добавяне на резултата.');
                console.error('Грешка:', error);
            }
        }); 
        async function compareResultWithNorms(user, disciplineId, valueTime) {
            const userAge = user.age; // Извличане на възрастта на потребителя
            const userGender = user.gender; // Извличане на пола на потребителя
        
            console.log(`Пол: ${userGender}, Възраст: ${userAge}, Дисциплина: ${disciplineId}`);
        
            try {
                const response = await fetch(`https://sportstatsapi.azurewebsites.net/api/Normatives/discipline/${disciplineId}`);
                if (!response.ok) throw new Error('Неуспешно извличане на нормативите');
        
                const norms = await response.json();
                console.log('Получени нормативи:', norms);
        
                const genderMapping = { 'Male': 'M', 'Female': 'F' };
                const mappedGender = genderMapping[userGender] || userGender;
        
                // Намиране на нормативи по възраст, пол и ID на дисциплината
                const norm = norms.find(norm => {
                    return norm.gender === mappedGender && userAge >= norm.minAge && userAge <= norm.maxAge && norm.disciplineId == disciplineId;
                });
        
                if (norm) {
                    // Сравняване на стойността на времето с необходимата стойност на нормата
                    const isQualified = valueTime <= norm.requiredValue;
                    alert(isQualified ? 'Поздравления! Вие отговаряте на нормата.' : 'Не отговаряте на нормата.');
                    return isQualified; 
                } else {
                    console.log(`Не са намерени нормативи за възрастта ${userAge}, пола ${userGender} и дисциплина ${disciplineId}`);
                    return false;
                }
            } catch (error) {
                console.error('Грешка при сравняването на резултата с нормативите:', error);
                return false;
            }
        }
    }
    
    document.getElementById('go-home').addEventListener('click', function () {
        window.location.href = 'HomePage.html';
    });

    await setupAddResultForm();
    await handleCoach();
});
