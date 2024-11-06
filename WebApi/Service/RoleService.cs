using SpoerStats2.IRepository;
using SpoerStats2.Models;
using System.Data;

namespace SpoerStats2.Service
{
    public class RoleService
    {
        private readonly IRoleRepository _roleRepository;

        public RoleService(IRoleRepository roleRepository)
        {
            _roleRepository = roleRepository;
        }

        public async Task<IEnumerable<Role>> GetAllRoles()
        {
            return await _roleRepository.GetAllRoles();
        }
    }
}
