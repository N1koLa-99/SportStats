using SpoerStats2.Models;

namespace SpoerStats2.Repository
{
    public interface IUserRepository
    {
        Task<IEnumerable<User>> GetAllUsers();
        Task<User> GetUserById(int id);
        Task AddUser(User user);
        Task UpdateUser(User user);
        Task DeleteUser(int id);
        Task<User> GetUserByEmail(string email);
        Task<User> GetUserByEmailAndPassword(string email, string password);
        Task<IEnumerable<User>> GetUsersByClubId(int clubId);
        Task UpdateFirstName(int id, string firstName);
        Task UpdateLastName(int id, string lastName);
        Task UpdateYearOfBirth(int id, int yearOfBirth);
        Task UpdateEmail(int id, string email);
        Task UpdatePassword(int id, string password);
        Task<IEnumerable<User>> SearchUsersByName(string query);
        Task<bool> DoesEmailExist(string email);

    }

}
