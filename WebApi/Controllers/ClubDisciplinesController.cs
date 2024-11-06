using Microsoft.AspNetCore.Mvc;
using SpoerStats2.Models;
using SpoerStats2.Service;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SpoerStats2.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ClubDisciplinesController : ControllerBase
    {
        private readonly ClubDisciplineService _clubDisciplineService;

        public ClubDisciplinesController(ClubDisciplineService clubDisciplineService)
        {
            _clubDisciplineService = clubDisciplineService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<ClubDiscipline>>> GetClubDisciplines()
        {
            return Ok(await _clubDisciplineService.GetAllClubDisciplines());
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ClubDiscipline>> GetClubDiscipline(int id)
        {
            var clubDiscipline = await _clubDisciplineService.GetClubDisciplineById(id);
            if (clubDiscipline == null) return NotFound();
            return Ok(clubDiscipline);
        }

        [HttpGet("by-club/{clubId}")]
        public async Task<ActionResult<IEnumerable<ClubDiscipline>>> GetClubDisciplinesByClubId(int clubId)
        {
            return Ok(await _clubDisciplineService.GetClubDisciplinesByClubId(clubId));
        }

        [HttpPost]
        public async Task<ActionResult<ClubDiscipline>> PostClubDiscipline(ClubDiscipline clubDiscipline)
        {
            await _clubDisciplineService.AddClubDiscipline(clubDiscipline);
            return CreatedAtAction("GetClubDiscipline", new { id = clubDiscipline.Id }, clubDiscipline);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutClubDiscipline(int id, ClubDiscipline clubDiscipline)
        {
            if (id != clubDiscipline.Id) return BadRequest();
            await _clubDisciplineService.UpdateClubDiscipline(clubDiscipline);
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteClubDiscipline(int id)
        {
            var clubDiscipline = await _clubDisciplineService.GetClubDisciplineById(id);
            if (clubDiscipline == null) return NotFound();
            await _clubDisciplineService.DeleteClubDiscipline(id);
            return NoContent();
        }
        [HttpGet("disciplines-by-club/{clubId}")]
        public async Task<ActionResult<IEnumerable<Discipline>>> GetDisciplinesByClubId(int clubId)
        {
            var disciplines = await _clubDisciplineService.GetDisciplinesByClubId(clubId);
            if (disciplines == null || !disciplines.Any()) return NotFound();
            return Ok(disciplines);
        }
    }
}
