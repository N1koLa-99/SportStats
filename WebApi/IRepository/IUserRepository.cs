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
        Task<User> GetUserByEmailAndPassword(string email, string password);
        Task<IEnumerable<User>> GetUsersByClubId(int clubId);
    }

}
