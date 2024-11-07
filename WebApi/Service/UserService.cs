using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.IO;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using System.Data.Common;
using System.Data.SqlClient;

public class UserService
{
    private readonly IUserRepository _userRepository;
    private readonly PasswordHasher<User> _passwordHasher;

    public UserService(IUserRepository userRepository)
    {
        _userRepository = userRepository ?? throw new ArgumentNullException(nameof(userRepository));
        _passwordHasher = new PasswordHasher<User>();
    }

    public async Task<IEnumerable<User>> GetAllUsers()
    {
        return await _userRepository.GetAllUsers();
    }

    public async Task<User> GetUserById(int id)
    {
        return await _userRepository.GetUserById(id);
    }

    public async Task AddUser(User user)
    {
        user.Password = _passwordHasher.HashPassword(user, user.Password);
        await _userRepository.AddUser(user);
    }

    public async Task UpdateUser(User user)
    {
        if (!string.IsNullOrWhiteSpace(user.Password))
        {
            user.Password = _passwordHasher.HashPassword(user, user.Password);
        }
        else
        {
            var existingUser = await _userRepository.GetUserById(user.Id);
            if (existingUser != null)
            {
                user.Password = existingUser.Password;
            }
        }

        await _userRepository.UpdateUser(user);
    }


    public async Task DeleteUser(int id)
    {
        await _userRepository.DeleteUser(id);
    }

    public async Task<User> GetUserByEmail(string email)
    {
        var user = await _userRepository.GetUserByEmail(email);
        return user;
    }

    public async Task<User> GetUserByEmailAndPassword(string email, string password)
    {
        var user = await _userRepository.GetUserByEmail(email);
        if (user == null) return null;

        var result = _passwordHasher.VerifyHashedPassword(user, user.Password, password);
        return result == PasswordVerificationResult.Success ? user : null;
    }
    public async Task<IEnumerable<User>> GetUsersByClubId(int clubId)
    {
        return await _userRepository.GetUsersByClubId(clubId);
    }

    public async Task<string> UpdateUserProfilePicture(int userId, IFormFile file)
    {
        // Проверка дали файлът е предоставен
        if (file == null || file.Length == 0)
            throw new ArgumentException("No file uploaded.");

        var user = await _userRepository.GetUserById(userId);
        if (user == null)
            throw new ArgumentException("User not found.");

        // Път за съхранение на снимката
        var directoryPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "ProfilePictures");

        // Създаване на директория, ако не съществува
        if (!Directory.Exists(directoryPath))
        {
            Directory.CreateDirectory(directoryPath);
        }

        // Запазване на файла с уникално име
        var fileName = $"{userId}_{Path.GetFileName(file.FileName)}"; // Увери се, че името на файла е безопасно
        var filePath = Path.Combine(directoryPath, fileName);

        // Записване на файла
        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        // Обновяване на профилната снимка в базата данни
        user.profileImage_url = Path.Combine("ProfilePictures", fileName);
        await _userRepository.UpdateUser(user);

        return user.profileImage_url; // Връща URL на профилната снимка
    }

    public async Task<string> GetUserProfilePictureUrl(int userId)
    {
        var user = await _userRepository.GetUserById(userId);
        if (user == null) throw new ArgumentException("User not found.");

        return user.profileImage_url; // Връща URL на профилната снимка
    }

    public async Task<FileContentResult> GetUserProfilePicture(int userId)
    {
        var user = await _userRepository.GetUserById(userId);
        if (user == null || string.IsNullOrEmpty(user.profileImage_url))
        {
            throw new ArgumentException("Profile picture not found.");
        }

        var filePath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", user.profileImage_url);
        if (!File.Exists(filePath))
        {
            throw new FileNotFoundException("Profile picture file not found.");
        }

        var fileBytes = await File.ReadAllBytesAsync(filePath);
        var fileExtension = Path.GetExtension(filePath).ToLower();
        var mimeType = fileExtension switch
        {
            ".jpg" => "image/jpeg",
            ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            _ => "application/octet-stream"
        };

        return new FileContentResult(fileBytes, mimeType);
    }
    public async Task UpdateFirstName(int id, string firstName)
    {
        var user = await _userRepository.GetUserById(id);
        if (user == null) throw new ArgumentException("User not found.");

        await _userRepository.UpdateFirstName(id, firstName);
    }

    public async Task UpdateLastName(int id, string lastName)
    {
        var user = await _userRepository.GetUserById(id);
        if (user == null) throw new ArgumentException("User not found.");

        await _userRepository.UpdateLastName(id, lastName);
    }

    public async Task UpdateAge(int id, int age)
    {
        var user = await _userRepository.GetUserById(id);
        if (user == null) throw new ArgumentException("User not found.");

        await _userRepository.UpdateAge(id, age);
    }

    public async Task UpdateEmail(int id, string email)
    {
        var user = await _userRepository.GetUserById(id);
        if (user == null) throw new ArgumentException("User not found.");

        await _userRepository.UpdateEmail(id, email);
    }

    public async Task UpdatePassword(int id, string newPassword)
    {
        var user = await _userRepository.GetUserById(id);
        if (user == null) throw new ArgumentException("User not found.");

        user.Password = _passwordHasher.HashPassword(user, newPassword);
        await _userRepository.UpdatePassword(id, user.Password);
    }

}
