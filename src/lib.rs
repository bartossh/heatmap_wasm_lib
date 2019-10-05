#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}

extern crate nalgebra as na;
extern crate js_sys;
extern crate serde;

use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;
use na::{Matrix, Dynamic, VecStorage, DMatrix, geometry::Point2, distance};
use serde::{Serialize, Deserialize};
// #[wasm_bindgen]
// extern {
    
// }

#[wasm_bindgen]
extern "C" {
    // Use `js_namespace` here to bind `console.log(..)` instead of just
    // `log(..)`
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    // Note that this is using the `log` function imported above during
    // `bare_bones`
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
struct HeatPoint {
    x: u32,
    y: u32,
    heat: u32
} 

impl HeatPoint {
    fn new (x: u32, y: u32, heat: u32) -> Self {
        Self {x, y, heat}
    }
}

#[wasm_bindgen]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct HeatMap {
    x_start: u32,
    y_start: u32,
    matrix: Matrix<u32, Dynamic, Dynamic, VecStorage<u32, Dynamic, Dynamic>>,
    cell_spacing: u32,
    brush_radius: u32,
    brush_intensity: u32,
    max_saturation: u32,
}

#[wasm_bindgen]
impl HeatMap {
    
    pub fn new(
        x_start: u32,
        y_start: u32,
        width: usize,
        height: usize,
        cell_spacing: u32,
        brush_radius: u32,
        brush_intensity: u32,
        max_saturation: u32,
        ) -> Self {
        let matrix = DMatrix::from_fn(height, width, |_, _| 0_u32);
        console_log!("Created {} - {}", &width, &height);
        Self {x_start, y_start, matrix, cell_spacing, brush_radius, brush_intensity, max_saturation}
    }

    /// Applies given heat point to HeatMap matrix
    /// 
    /// # Argument
    /// 
    /// * x - x coordinate
    /// * y - y coordinate
    /// * heat - heat value
    /// * can_apply - if true heat point will be applied, or omitted otherwise
    ///
    pub fn update(&mut self, x: u32, y: u32, heat: u32, can_apply: bool) {
        // copy or clone as we are borrowing self.matrix as mutable
        let _height = self.matrix.nrows() as f64;
        let coordinates: Point2<f64> = Point2::new(x as f64, y as f64);
        let cell_spacing = self.cell_spacing * heat;
        let brush_radius = self.brush_radius * heat;
        let brush_intensity = self.brush_intensity * heat;
        let x_start = self.x_start;
        let y_start = self.y_start;
        let max_saturation = self.max_saturation;
        // zero row and acknowledge we are going to iterate matrix in row order from the first row to last row
        let mut row = 0;
        let mut first_element = true;
        // map received heat point to the matrix grid
        &self.matrix.iter_mut().enumerate().for_each(|(i, v)| {
            let column = (i as f64 % _height as f64) as u32;
            if column == 0 && !first_element {
                row += 1;
            }
            // cool it down on each update
            if *v > 0 {
                *v -= 1;
            }
            // distribute heat
            if can_apply {
                let point: Point2<f64> = Point2::new((column * cell_spacing + x_start) as f64, (row * cell_spacing + y_start) as f64);
                let distance_from_coordinates = distance(&coordinates, &point); // nalgebra 2D euclidean distance 
                if distance_from_coordinates < (brush_radius * cell_spacing) as f64 {
                    // map grid by scaling in 2D euclidean plane 
                    *v += map_scaled_value(distance_from_coordinates, 0_f64, (brush_radius + cell_spacing) as f64, brush_intensity as f64, 0_f64) as u32;
                    if *v > max_saturation {
                        *v = max_saturation
                    }
                }
            }
            // We can activate row counter
            first_element = false;
        });
        // console_log!("matrix_copy {:?}", &self.matrix);
    }

    /// Calls passed javascript function on every HeatMam matrix grid point
    /// 
    /// # Argument
    /// 
    /// * sketch - javascript p5 sketch function
    /// * fill - javascript fill function
    /// * draw - javascript draw function
    ///
    pub fn draw(&self, callback: &js_sys::Function, sketch: &js_sys::Function) {
        // zero row and acknowledge we are going to iterate matrix in row order from the first row to last row
        let mut row = 0;
        let mut first_element = true;
        &self.matrix.iter().enumerate().for_each(|(i, v)| {
            let column = (i as f64 % self.matrix.nrows() as f64) as u32;
            if column == 0 && !first_element {
                row += 1;
            }
            if *v > 0 {
                // set arguments for js apply function
                let heat_point = HeatPoint::new(column, row, *v);
                if let Ok(serialized) = serde_json::to_string(&heat_point) {
                    if let Err(_) = callback.call2(&JsValue::null(), sketch, &JsValue::from_str(&serialized)) {
                        console_log!("Error with calling callbacks passed to wasm draw functions");
                    };
                } else {
                    console_log!("Heat point cannot be serialized");
                };
            }
            // We can activate row counter
            first_element = false;
        });
    }

    pub fn test_js_call(&self, callback: &js_sys::Function, num: f64) {
         console_log!("{:?}", callback.call1(&JsValue::null(), &JsValue::from_f64(num)).unwrap());
    }
}

fn map_scaled_value(value: f64, _from_start: f64, _from_finnish: f64, _to_start: f64, _to_finnish: f64) -> f64 {
    _to_start + (value * (_to_finnish - _to_start) / (_from_finnish - _from_start)).abs()
}