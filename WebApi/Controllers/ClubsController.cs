using Microsoft.AspNetCore.Mvc;
using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SpoerStats2.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ClubsController : ControllerBase
    {
        private readonly IClubRepository _clubRepository;

        public ClubsController(IClubRepository clubRepository)
        {
            _clubRepository = clubRepository;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Club>>> GetClubs()
        {
            return Ok(await _clubRepository.GetAllClubs());
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Club>> GetClub(int id)
        {
            var club = await _clubRepository.GetClubById(id);

            if (club == null)
            {
                return NotFound();
            }

            return Ok(club);
        }

        [HttpPost]
        public async Task<ActionResult<Club>> PostClub(Club club)
        {
            await _clubRepository.AddClub(club);
            return CreatedAtAction("GetClub", new { id = club.Id }, club);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutClub(int id, Club club)
        {
            if (id != club.Id)
            {
                return BadRequest();
            }

            await _clubRepository.UpdateClub(club);
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteClub(int id)
        {
            var club = await _clubRepository.GetClubById(id);

            if (club == null)
            {
                return NotFound();
            }

            await _clubRepository.DeleteClub(id);
            return NoContent();
        }
    }
}
