using Microsoft.AspNetCore.Mvc;
using SpoerStats2.Models;
using System.Security.Claims;
using System.IO;
using Microsoft.AspNetCore.Identity;

namespace SpoerStats2.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        private readonly UserService _userService;
        private readonly ILogger<UsersController> _logger;

        public UsersController(UserService userService, ILogger<UsersController> logger)
        {
            _userService = userService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<IEnumerable<User>>> GetUsers()
        {
            return Ok(await _userService.GetAllUsers());
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<User>> GetUser(int id)
        {
            var user = await _userService.GetUserById(id);
            if (user == null) return NotFound();
            return Ok(user);
        }

        [HttpPost]
        public async Task<ActionResult<User>> PostUser(User user)
        {
            await _userService.AddUser(user);
            return CreatedAtAction("GetUser", new { id = user.Id }, user);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateUser(int id, [FromBody] User user)
        {
            if (id != user.Id)
            {
                return BadRequest("User ID mismatch.");
            }

            var existingUser = await _userService.GetUserById(id);
            if (existingUser == null)
            {
                return NotFound("User not found.");
            }

            try
            {
                await _userService.UpdateUser(user);
                return Ok(user);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user with ID {Id}.", id);
                return StatusCode(500, "Internal server error.");
            }
        }



        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var user = await _userService.GetUserById(id);
            if (user == null) return NotFound();
            await _userService.DeleteUser(id);
            return NoContent();
        }

        [HttpPost("login")]
        public async Task<ActionResult<User>> Login([FromBody] UserLogin loginData)
        {
            var user = await _userService.GetUserByEmailAndPassword(loginData.Email, loginData.Password);
            if (user == null)
            {
                return Unauthorized();
            }
            UserSession result = new UserSession(user);
            result.UserTokenHash = result.GetUserTokenHash();
            return Ok(result);
        }

        private int GetUserIdFromToken()
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == ClaimTypes.NameIdentifier);
            if (userIdClaim == null)
            {
                throw new UnauthorizedAccessException("Token does not contain user ID.");
            }
            var userId = int.Parse(userIdClaim.Value);
            _logger.LogInformation("Получен userId от токена: {userId}", userId);
            return userId;
        }

        [HttpGet("me")]
        public async Task<ActionResult<User>> GetCurrentUser()
        {
            try
            {
                var userId = GetUserIdFromToken();
                var user = await _userService.GetUserById(userId);

                if (user == null)
                {
                    return NotFound();
                }

                return Ok(user);
            }
            catch (UnauthorizedAccessException ex)
            {
                return Unauthorized(new { message = ex.Message });
            }
        }

        [HttpGet("club/{clubId}")]
        public async Task<ActionResult<IEnumerable<User>>> GetUsersByClubId(int clubId)
        {
            var users = await _userService.GetUsersByClubId(clubId);
            if (users == null || !users.Any())
            {
                return NotFound();
            }
            return Ok(users);
        }

        [HttpPost("uploadProfilePicture/{userId}")]
        public async Task<IActionResult> UploadProfilePicture(int userId, IFormFile file)
        {
            try
            {
                var profileImageUrl = await _userService.UpdateUserProfilePicture(userId, file);
                return Ok(new { profileImage_url = profileImageUrl });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating profile picture for user {userId}", userId);
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("profilePicture/{userId}")]
        public async Task<IActionResult> GetUserProfilePicture(int userId)
        {
            try
            {
                var result = await _userService.GetUserProfilePicture(userId);
                return result;
            }
            catch (ArgumentException ex)
            {
                _logger.LogError(ex, "Profile picture not found for user {userId}", userId);
                return NotFound(new { message = ex.Message });
            }
            catch (FileNotFoundException ex)
            {
                _logger.LogError(ex, "File not found for user {userId}", userId);
                return NotFound(new { message = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while retrieving profile picture for user {userId}", userId);
                return StatusCode(500, new { message = "An error occurred while retrieving the profile picture." });
            }
        }

        // Update FirstName
        [HttpPost("{id}/update-firstname")]
        public async Task<IActionResult> UpdateFirstName(int id, [FromBody] string firstName)
        {
            var user = await _userService.GetUserById(id);
            if (user == null) return NotFound("User not found.");

            user.FirstName = firstName;
            await _userService.UpdateUser(user);
            return Ok("First name updated successfully.");
        }

        // Update LastName
        [HttpPost("{id}/update-lastname")]
        public async Task<IActionResult> UpdateLastName(int id, [FromBody] string lastName)
        {
            var user = await _userService.GetUserById(id);
            if (user == null) return NotFound("User not found.");

            user.LastName = lastName;
            await _userService.UpdateUser(user);
            return Ok("Last name updated successfully.");
        }

        // Update YearOfBirth
        [HttpPost("{id}/update-yearofbirth")]
        public async Task<IActionResult> UpdateYearOfBirth(int id, [FromBody] int yearOfBirth)
        {
            var user = await _userService.GetUserById(id);
            if (user == null)
                return NotFound("User not found.");

            if (yearOfBirth < 1900 || yearOfBirth > DateTime.Now.Year)
                return BadRequest("Invalid Year of Birth.");

            user.YearOfBirth = yearOfBirth;
            await _userService.UpdateUser(user);
            return Ok("Year of birth updated successfully.");
        }

        // Update Email
        [HttpPost("{id}/update-email")]
        public async Task<IActionResult> UpdateEmail(int id, [FromBody] string email)
        {
            var user = await _userService.GetUserById(id);
            if (user == null) return NotFound("User not found.");

            user.Email = email;
            await _userService.UpdateUser(user);
            return Ok("Email updated successfully.");
        }

        // Update Password
        [HttpPost("{id}/update-password")]
        public async Task<IActionResult> UpdatePassword(int id, [FromBody] string password)
        {
            var user = await _userService.GetUserById(id);
            if (user == null) return NotFound("User not found.");

            await _userService.UpdatePassword(id, password);
            return Ok("Password updated successfully.");
        }

        [HttpGet("search")]
        public async Task<ActionResult<IEnumerable<User>>> SearchUsers([FromQuery] string query)
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                return BadRequest("Search query cannot be empty.");
            }

            var users = await _userService.SearchUsersByName(query);
            if (users == null || !users.Any())
            {
                return NotFound("No users found matching the query.");
            }

            return Ok(users);
        }
    }
}
