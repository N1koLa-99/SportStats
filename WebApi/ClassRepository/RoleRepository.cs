using SpoerStats2.IRepository;
using System.Data.SqlClient;
using System.Data;
using Dapper;
using SpoerStats2.Models;

namespace SpoerStats2.ClassRepository
{
    public class RoleRepository : IRoleRepository
    {
        private readonly string _connectionString;

        public RoleRepository(IConfiguration configuration)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
        }

        public async Task<IEnumerable<Role>> GetAllRoles()
        {
            using (var connection = new SqlConnection(_connectionString))
            {
                return await connection.QueryAsync<Role>("SELECT * FROM Roles");
            }
        }
    }
}
