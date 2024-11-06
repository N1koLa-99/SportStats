using Microsoft.AspNetCore.Mvc;
using SpoerStats2.Models;
using SpoerStats2.Repository;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace SpoerStats2.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SportsController : ControllerBase
    {
        private readonly SportService _sportService;

        public SportsController(SportService sportService)
        {
            _sportService = sportService;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Sport>>> GetSports()
        {
            try
            {
                var sports = await _sportService.GetAllSports();
                return Ok(sports);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<Sport>> GetSport(int id)
        {
            try
            {
                var sport = await _sportService.GetSportById(id);
                if (sport == null) return NotFound();
                return Ok(sport);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPost]
        public async Task<ActionResult<Sport>> PostSport(Sport sport)
        {
            try
            {
                await _sportService.AddSport(sport);
                return CreatedAtAction("GetSport", new { id = sport.Id }, sport);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> PutSport(int id, Sport sport)
        {
            if (id != sport.Id) return BadRequest();

            try
            {
                await _sportService.UpdateSport(sport);
                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal server error");
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSport(int id)
        {
            try
            {
                var sport = await _sportService.GetSportById(id);
                if (sport == null) return NotFound();
                await _sportService.DeleteSport(id);
                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal server error");
            }
        }
    }
}
