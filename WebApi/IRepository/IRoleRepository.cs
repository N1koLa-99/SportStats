using SpoerStats2.Models;
using System.Data;

namespace SpoerStats2.IRepository
{
    public interface IRoleRepository
    {
        Task<IEnumerable<Role>> GetAllRoles();
    }
}
