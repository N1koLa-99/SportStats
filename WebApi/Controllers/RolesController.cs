using Microsoft.AspNetCore.Mvc;
using SpoerStats2.Models;
using SpoerStats2.Service;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SpoerStats2.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class RolesController : ControllerBase
    {
        private readonly RoleService _roleService;

        public RolesController(RoleService roleService)
        {
            _roleService = roleService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Role>>> GetRoles()
        {
            return Ok(await _roleService.GetAllRoles());
        }
    }
}
